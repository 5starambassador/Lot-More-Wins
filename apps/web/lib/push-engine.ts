import crypto from 'crypto';
import { Prisma, type PushCampaign, type PushCampaignRun, type PushTemplate } from '@prisma/client';
import { z } from 'zod';
import prisma from './prisma';
import { HttpError } from './auth';
import { sendPush, type PushMessage } from './push';
import {
  isValidPushUrl,
  matchesFilter,
  nextOccurrence,
  type Audience,
  type AudienceFilter,
  type AudienceRow,
  type PushCampaignItem,
  type PushOverview,
  type PushPlatform,
  type PushRunItem,
  type PushTemplateItem,
  type ScheduleSpec,
} from './push-engine-shared';

/**
 * Push notification engine (Super Admin → Push notifications).
 *
 * A template is a reusable message. Sending or scheduling it makes a campaign with a copy of the
 * message, an audience and a schedule (now, once, daily, weekly; IST). The dispatcher
 * (GET /api/cron/push-campaigns, also run whenever the page is open) sends whatever is due.
 * Every send is a run row created before anything goes out (unique per campaign and due time),
 * so a send happens once however many dispatchers fire at the same moment.
 *
 * Pushes go through Expo to Android (FCM) and iOS (APNs) alike. Partners without a registered
 * device still get the message in the app's Notifications list when "save to inbox" is on.
 */

/** A due send more than this late is recorded as missed instead of going out at an odd hour. */
const LATE_LIMIT_MS = 2 * 60 * 60_000;
const DISPATCHER_MARKER = 'push-dispatcher';

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null));

export const templateSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the template a name').max(80),
    title: z.string().trim().min(1, 'Title is required').max(120, 'Keep the title under 120 characters'),
    body: z.string().trim().min(1, 'Message is required').max(500, 'Keep the message under 500 characters'),
    detail: optionalText(5000),
    url: optionalText(500).refine((v) => v === null || isValidPushUrl(v), 'Use an app page (e.g. /wallet) or a web link starting with https://'),
  })
  .strict();

const range = z
  .object({ min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() })
  .strict()
  .optional();

export const filterSchema: z.ZodType<AudienceFilter> = z
  .object({
    search: z.string().max(100).optional(),
    statuses: z.array(z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'])).optional(),
    categories: z.array(z.enum(['ACHARIYA', 'NON_ACHARIYA'])).optional(),
    cities: z.array(z.string().max(100)).max(50).optional(),
    joinedFrom: day.optional(),
    joinedTo: day.optional(),
    devices: z.enum(['any', 'with', 'android', 'ios', 'none']).optional(),
    registeredReferrals: range,
    referralBills: range,
    personalBills: range,
    redeemBills: range,
    activeWithinDays: z.number().int().min(1).max(3650).optional(),
    inactiveForDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict();

const audienceSchema: z.ZodType<Audience> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }).strict(),
  z.object({ kind: z.literal('filter'), filter: filterSchema }).strict(),
  z.object({ kind: z.literal('partners'), ids: z.array(z.string().uuid()).min(1, 'Select at least one partner').max(50_000) }).strict(),
]);

export const campaignSchema = z
  .object({
    templateId: z.string().uuid(),
    audience: audienceSchema,
    platforms: z.array(z.enum(['android', 'ios'])).min(1, 'Choose Android, iOS or both'),
    saveToInbox: z.boolean().default(true),
    schedule: z
      .object({
        type: z.enum(['NOW', 'ONCE', 'DAILY', 'WEEKLY']),
        sendAt: z.string().datetime({ offset: true }).optional().nullable(),
        timeOfDay: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a HH:MM time')
          .optional()
          .nullable(),
        weekdays: z.array(z.number().int().min(0).max(6)).optional(),
        startDate: day.optional().nullable(),
        endDate: day.optional().nullable(),
      })
      .strict(),
  })
  .strict();

// ----------------------------------------------------------------------------
// Audience
// ----------------------------------------------------------------------------

interface AudienceSqlRow {
  id: string;
  partner_code: string;
  name: string;
  mobile: string;
  city: string | null;
  status: AudienceRow['status'];
  category: AudienceRow['category'];
  created_at: Date;
  registered_referrals: number;
  referral_bills: number;
  personal_bills: number;
  redeem_bills: number;
  last_bill_at: Date | null;
  android_devices: number;
  ios_devices: number;
}

/** Every partner with the counts the audience is filtered and grouped by (one query). */
export async function loadAudienceRows(): Promise<AudienceRow[]> {
  const rows = await prisma.$queryRaw<AudienceSqlRow[]>`
    WITH reg AS (
      SELECT referred_by_partner_id AS id, count(*)::int AS n
      FROM partners WHERE referred_by_partner_id IS NOT NULL GROUP BY 1
    ),
    ref AS (
      SELECT referrer_partner_id AS id, count(*)::int AS n, max(created_at) AS last
      FROM bills WHERE transaction_type = 'REFERRAL' AND referrer_partner_id IS NOT NULL GROUP BY 1
    ),
    own AS (
      SELECT partner_id AS id,
             count(*) FILTER (WHERE transaction_type = 'DIRECT_PARTNER')::int AS personal,
             count(*) FILTER (WHERE transaction_type = 'WALLET_REDEEM')::int AS redeem,
             max(created_at) AS last
      FROM bills WHERE partner_id IS NOT NULL GROUP BY 1
    ),
    dev AS (
      SELECT partner_id AS id,
             count(*) FILTER (WHERE platform = 'ios')::int AS ios,
             count(*) FILTER (WHERE platform IS DISTINCT FROM 'ios')::int AS android
      FROM push_devices GROUP BY 1
    )
    SELECT p.id, p.partner_code, p.name, p.mobile, p.city, p.status::text AS status, p.category::text AS category, p.created_at,
           COALESCE(reg.n, 0) AS registered_referrals,
           COALESCE(ref.n, 0) AS referral_bills,
           COALESCE(own.personal, 0) AS personal_bills,
           COALESCE(own.redeem, 0) AS redeem_bills,
           GREATEST(ref.last, own.last) AS last_bill_at,
           COALESCE(dev.android, 0) AS android_devices,
           COALESCE(dev.ios, 0) AS ios_devices
    FROM partners p
    LEFT JOIN reg ON reg.id = p.id
    LEFT JOIN ref ON ref.id = p.id
    LEFT JOIN own ON own.id = p.id
    LEFT JOIN dev ON dev.id = p.id
    ORDER BY p.created_at DESC`;
  return rows.map((r) => ({
    id: r.id,
    partnerCode: r.partner_code,
    name: r.name,
    mobile: r.mobile,
    city: r.city,
    status: r.status,
    category: r.category,
    joinedAt: r.created_at.toISOString(),
    registeredReferrals: r.registered_referrals,
    referralBills: r.referral_bills,
    personalBills: r.personal_bills,
    redeemBills: r.redeem_bills,
    lastBillAt: r.last_bill_at?.toISOString() ?? null,
    androidDevices: r.android_devices,
    iosDevices: r.ios_devices,
  }));
}

/** The partners an audience reaches now. Only active partners are ever sent to. */
export async function resolveAudience(audience: Audience): Promise<string[]> {
  if (audience.kind === 'partners') {
    const rows = await prisma.partner.findMany({ where: { id: { in: audience.ids }, status: 'ACTIVE' }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  if (audience.kind === 'all') {
    const rows = await prisma.partner.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  const now = Date.now();
  return (await loadAudienceRows()).filter((r) => r.status === 'ACTIVE' && matchesFilter(r, audience.filter, now)).map((r) => r.id);
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

export async function listTemplates(): Promise<PushTemplateItem[]> {
  const templates = await prisma.pushTemplate.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { campaigns: true } } },
  });
  const last = await prisma.pushCampaignRun.groupBy({
    by: ['campaignId'],
    where: { status: 'sent', campaign: { templateId: { in: templates.map((t) => t.id) } } },
    _max: { startedAt: true },
  });
  const campaignTemplate = new Map(
    (await prisma.pushCampaign.findMany({ where: { id: { in: last.map((l) => l.campaignId) } }, select: { id: true, templateId: true } })).map((c) => [c.id, c.templateId])
  );
  const lastByTemplate = new Map<string, Date>();
  for (const l of last) {
    const t = campaignTemplate.get(l.campaignId);
    const at = l._max.startedAt;
    if (t && at && (!lastByTemplate.has(t) || lastByTemplate.get(t)! < at)) lastByTemplate.set(t, at);
  }
  return templates.map((t) => serializeTemplate(t, t._count.campaigns, lastByTemplate.get(t.id) ?? null));
}

function serializeTemplate(t: PushTemplate, campaigns = 0, lastSentAt: Date | null = null): PushTemplateItem {
  return {
    id: t.id,
    name: t.name,
    title: t.title,
    body: t.body,
    detail: t.detail,
    url: t.url,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    campaigns,
    lastSentAt: lastSentAt?.toISOString() ?? null,
  };
}

export async function getTemplate(id: string): Promise<PushTemplate> {
  const t = await prisma.pushTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!t) throw new HttpError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');
  return t;
}

export async function getTemplateItem(id: string): Promise<PushTemplateItem> {
  return serializeTemplate(await getTemplate(id));
}

export async function createTemplate(input: z.infer<typeof templateSchema>, adminName: string) {
  return serializeTemplate(await prisma.pushTemplate.create({ data: { ...input, createdBy: adminName } }));
}

export async function updateTemplate(id: string, input: z.infer<typeof templateSchema>) {
  await getTemplate(id);
  return serializeTemplate(await prisma.pushTemplate.update({ where: { id }, data: input }));
}

/** Scheduled campaigns keep their own copy of the message, so deleting a template stops nothing. */
export async function deleteTemplate(id: string) {
  await getTemplate(id);
  await prisma.pushTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ----------------------------------------------------------------------------
// Sending
// ----------------------------------------------------------------------------

type Message = Pick<PushCampaign, 'title' | 'body' | 'detail' | 'url' | 'saveToInbox'> & { platforms: PushPlatform[] };

interface SendTotals {
  partners: number;
  devices: number;
  accepted: number;
  errors: Record<string, number>;
}

/**
 * Sends a message to partners: adds it to their Notifications list (when saveToInbox) and pushes
 * it to their devices on the chosen platforms. The push data carries the notification id and the
 * url, so a tap opens the right place; older apps ignore the url and open Notifications.
 */
async function deliver(message: Message, partnerIds: string[]): Promise<SendTotals> {
  const totals: SendTotals = { partners: partnerIds.length, devices: 0, accepted: 0, errors: {} };
  if (partnerIds.length === 0) return totals;
  const url = message.url ?? undefined;
  let messages: PushMessage[];
  if (message.saveToInbox) {
    const createdAt = new Date();
    const rows = partnerIds.map((partnerId) => ({
      id: crypto.randomUUID(),
      partnerId,
      type: 'OFFER' as const,
      title: message.title,
      body: message.body,
      detail: message.detail,
      url: message.url,
      createdAt,
    }));
    for (let i = 0; i < rows.length; i += 1000) await prisma.notification.createMany({ data: rows.slice(i, i + 1000) });
    messages = rows.map((r) => ({ partnerId: r.partnerId, title: r.title, body: r.body, data: { type: 'OFFER', notificationId: r.id, ...(url ? { url } : {}) } }));
  } else {
    messages = partnerIds.map((partnerId) => ({ partnerId, title: message.title, body: message.body, data: { type: 'GREETING', ...(url ? { url } : {}) } }));
  }

  // Only partners with a device on the chosen platforms need a push request.
  const reachable = new Set(
    (
      await prisma.pushDevice.findMany({
        where: { partnerId: { in: partnerIds } },
        select: { partnerId: true, platform: true },
      })
    )
      .filter((d) => message.platforms.includes(d.platform === 'ios' ? 'ios' : 'android'))
      .map((d) => d.partnerId)
  );
  const toPush = messages.filter((m) => reachable.has(m.partnerId));
  for (let i = 0; i < toPush.length; i += 100) {
    const result = await sendPush(toPush.slice(i, i + 100), { platforms: message.platforms });
    totals.devices += result.devices;
    totals.accepted += result.accepted;
    for (const code of result.errors) totals.errors[code] = (totals.errors[code] ?? 0) + 1;
  }
  return totals;
}

/** Creates the run row for an occurrence; false when another sender already has it. */
async function claimRun(data: Prisma.PushCampaignRunCreateManyInput): Promise<boolean> {
  const { count } = await prisma.pushCampaignRun.createMany({ data: [data], skipDuplicates: true });
  return count === 1;
}

/** Claims and sends one occurrence of a campaign. Null when another sender already claimed it. */
async function executeRun(campaign: PushCampaign, scheduledFor: Date): Promise<PushCampaignRun | null> {
  if (!(await claimRun({ campaignId: campaign.id, scheduledFor }))) return null;
  const run = await prisma.pushCampaignRun.findUniqueOrThrow({ where: { campaignId_scheduledFor: { campaignId: campaign.id, scheduledFor } } });
  try {
    const ids = await resolveAudience(campaign.audience as unknown as Audience);
    const totals = await deliver({ ...campaign, platforms: campaign.platforms as PushPlatform[] }, ids);
    console.log(`Push campaign ${campaign.id} run ${scheduledFor.toISOString()}:`, JSON.stringify(totals));
    return await prisma.pushCampaignRun.update({
      where: { id: run.id },
      data: { status: 'sent', finishedAt: new Date(), partners: totals.partners, devices: totals.devices, accepted: totals.accepted, errors: totals.errors },
    });
  } catch (error) {
    console.error(`Push campaign ${campaign.id} run failed:`, error);
    return await prisma.pushCampaignRun.update({
      where: { id: run.id },
      data: { status: 'failed', finishedAt: new Date(), errors: { SERVER_ERROR: 1 } },
    });
  }
}

const specOf = (c: PushCampaign): ScheduleSpec => ({
  type: c.scheduleType,
  sendAt: c.sendAt?.toISOString() ?? null,
  timeOfDay: c.timeOfDay,
  weekdays: c.weekdays,
  startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
  endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
});

/** Sends every campaign that is due. Safe to run from several places at once. */
export async function dispatchDuePushes(now = new Date()) {
  await prisma.systemHealth.upsert({
    where: { id: DISPATCHER_MARKER },
    create: { id: DISPATCHER_MARKER, status: 'ok', checkedAt: now },
    update: { checkedAt: now },
  });
  const due = await prisma.pushCampaign.findMany({
    where: { status: 'SCHEDULED', nextRunAt: { lte: now } },
    orderBy: { nextRunAt: 'asc' },
    take: 20,
  });
  const report: { campaignId: string; dueAt: string; result: string }[] = [];
  for (const c of due) {
    const dueAt = c.nextRunAt!;
    let result: string;
    if (now.getTime() - dueAt.getTime() > LATE_LIMIT_MS) {
      result = (await claimRun({ campaignId: c.id, scheduledFor: dueAt, status: 'missed', finishedAt: now })) ? 'missed' : 'already handled';
    } else {
      const run = await executeRun(c, dueAt);
      result = run ? run.status : 'already handled';
    }
    // A one-off is done once its occurrence is handled.
    const next = c.scheduleType === 'ONCE' ? null : nextOccurrence(specOf(c), new Date(Math.max(now.getTime(), dueAt.getTime())));
    // Moves on only from this occurrence, so a pause or cancel made meanwhile is kept.
    await prisma.pushCampaign.updateMany({
      where: { id: c.id, status: 'SCHEDULED', nextRunAt: dueAt },
      data: { nextRunAt: next, ...(next ? {} : { status: 'COMPLETED' }) },
    });
    report.push({ campaignId: c.id, dueAt: dueAt.toISOString(), result });
  }
  return { checkedAt: now.toISOString(), due: due.length, report };
}

// ----------------------------------------------------------------------------
// Campaigns
// ----------------------------------------------------------------------------

export async function createCampaign(input: z.infer<typeof campaignSchema>, adminName: string) {
  const template = await getTemplate(input.templateId);
  const s = input.schedule;
  const now = new Date();
  const spec: ScheduleSpec = {
    type: s.type,
    sendAt: s.type === 'ONCE' ? (s.sendAt ?? null) : null,
    timeOfDay: s.type === 'DAILY' || s.type === 'WEEKLY' ? (s.timeOfDay ?? null) : null,
    weekdays: s.type === 'WEEKLY' ? [...new Set(s.weekdays ?? [])].sort() : [],
    startDate: s.type === 'DAILY' || s.type === 'WEEKLY' ? (s.startDate ?? null) : null,
    endDate: s.type === 'DAILY' || s.type === 'WEEKLY' ? (s.endDate ?? null) : null,
  };
  if (spec.type === 'ONCE' && (!spec.sendAt || Date.parse(spec.sendAt) <= now.getTime()))
    throw new HttpError(400, 'Choose a send time in the future', 'VALIDATION_ERROR');
  if ((spec.type === 'DAILY' || spec.type === 'WEEKLY') && !spec.timeOfDay) throw new HttpError(400, 'Choose the time of day', 'VALIDATION_ERROR');
  if (spec.type === 'WEEKLY' && !spec.weekdays?.length) throw new HttpError(400, 'Choose at least one weekday', 'VALIDATION_ERROR');
  if (spec.startDate && spec.endDate && spec.endDate < spec.startDate) throw new HttpError(400, 'The end date is before the start date', 'VALIDATION_ERROR');

  const next = spec.type === 'NOW' ? null : nextOccurrence(spec, now);
  if (spec.type !== 'NOW' && !next) throw new HttpError(400, 'This schedule has no send left before its end date', 'VALIDATION_ERROR');

  const audienceIds = await resolveAudience(input.audience);
  if (audienceIds.length === 0) throw new HttpError(400, 'No active partners in this audience', 'EMPTY_AUDIENCE');

  const campaign = await prisma.pushCampaign.create({
    data: {
      templateId: template.id,
      title: template.title,
      body: template.body,
      detail: template.detail,
      url: template.url,
      audience: input.audience as unknown as Prisma.InputJsonValue,
      audienceSize: audienceIds.length,
      platforms: input.platforms,
      saveToInbox: input.saveToInbox,
      scheduleType: spec.type,
      sendAt: spec.sendAt ? new Date(spec.sendAt) : null,
      timeOfDay: spec.timeOfDay,
      weekdays: spec.weekdays ?? [],
      startDate: spec.startDate ? new Date(`${spec.startDate}T00:00:00Z`) : null,
      endDate: spec.endDate ? new Date(`${spec.endDate}T00:00:00Z`) : null,
      nextRunAt: next,
      status: spec.type === 'NOW' ? 'COMPLETED' : 'SCHEDULED',
      createdBy: adminName,
    },
  });
  const run = spec.type === 'NOW' ? await executeRun(campaign, now) : null;
  return { campaign: await getCampaignItem(campaign.id), run: run ? serializeRun(run, campaign.title) : null };
}

export async function changeCampaign(id: string, action: 'pause' | 'resume' | 'cancel' | 'sendNow') {
  const c = await prisma.pushCampaign.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');
  const open = c.status === 'SCHEDULED' || c.status === 'PAUSED';
  if (action === 'sendNow') {
    // An extra send of the same message to the same audience, now; the schedule is unchanged.
    const run = await executeRun(c, new Date());
    return { campaign: await getCampaignItem(id), run: run ? serializeRun(run, c.title) : null };
  }
  if (!open) throw new HttpError(409, 'This campaign has already finished', 'CAMPAIGN_CLOSED');
  if (action === 'pause') await prisma.pushCampaign.update({ where: { id }, data: { status: 'PAUSED' } });
  if (action === 'cancel') await prisma.pushCampaign.update({ where: { id }, data: { status: 'CANCELLED', nextRunAt: null } });
  if (action === 'resume') {
    const next = nextOccurrence(specOf(c), new Date());
    if (!next) throw new HttpError(409, 'Its send time has passed. Schedule it again from the template.', 'SCHEDULE_PASSED');
    await prisma.pushCampaign.update({ where: { id }, data: { status: 'SCHEDULED', nextRunAt: next } });
  }
  return { campaign: await getCampaignItem(id), run: null };
}

function serializeRun(r: PushCampaignRun, title: string): PushRunItem {
  return {
    id: r.id,
    campaignId: r.campaignId,
    title,
    scheduledFor: r.scheduledFor.toISOString(),
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    status: r.status as PushRunItem['status'],
    partners: r.partners,
    devices: r.devices,
    accepted: r.accepted,
    errors: (r.errors as Record<string, number> | null) ?? {},
  };
}

type CampaignWithRuns = PushCampaign & {
  template: { name: string } | null;
  runs: PushCampaignRun[];
  _count: { runs: number };
};

const campaignInclude = {
  template: { select: { name: true } },
  runs: { orderBy: { startedAt: 'desc' as const }, take: 1 },
  _count: { select: { runs: true } },
};

function serializeCampaign(c: CampaignWithRuns): PushCampaignItem {
  return {
    ...specOf(c),
    id: c.id,
    templateId: c.templateId,
    templateName: c.template?.name ?? null,
    title: c.title,
    body: c.body,
    detail: c.detail,
    url: c.url,
    audience: c.audience as unknown as Audience,
    audienceSize: c.audienceSize,
    platforms: c.platforms as PushPlatform[],
    saveToInbox: c.saveToInbox,
    status: c.status,
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    runCount: c._count.runs,
    lastRun: c.runs[0] ? serializeRun(c.runs[0], c.title) : null,
  };
}

async function getCampaignItem(id: string): Promise<PushCampaignItem> {
  return serializeCampaign(await prisma.pushCampaign.findUniqueOrThrow({ where: { id }, include: campaignInclude }));
}

export async function listCampaigns(): Promise<PushCampaignItem[]> {
  const rows = await prisma.pushCampaign.findMany({
    include: campaignInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  });
  // Scheduled and paused first, by next send; then the rest, newest first.
  const rank = (c: PushCampaign) => (c.status === 'SCHEDULED' ? 0 : c.status === 'PAUSED' ? 1 : 2);
  return rows
    .sort((a, b) => rank(a) - rank(b) || (rank(a) < 2 ? (a.nextRunAt?.getTime() ?? 0) - (b.nextRunAt?.getTime() ?? 0) : 0))
    .map(serializeCampaign);
}

export async function listRuns(campaignId?: string): Promise<PushRunItem[]> {
  const runs = await prisma.pushCampaignRun.findMany({
    where: campaignId ? { campaignId } : {},
    include: { campaign: { select: { title: true } } },
    orderBy: { startedAt: 'desc' },
    take: 200,
  });
  return runs.map((r) => serializeRun(r, r.campaign.title));
}

/**
 * Removes one send from the history. Pushes already delivered (and their Notifications-list
 * entries) stay with the partners. A send still in progress cannot be removed; one stuck in
 * "sending" for over 15 minutes can.
 */
export async function deleteRun(id: string) {
  const run = await prisma.pushCampaignRun.findUnique({ where: { id } });
  if (!run) throw new HttpError(404, 'This send is no longer in the history', 'RUN_NOT_FOUND');
  if (run.status === 'sending' && Date.now() - run.startedAt.getTime() < 15 * 60_000)
    throw new HttpError(409, 'This send is still going out. Try again in a few minutes.', 'RUN_IN_PROGRESS');
  await prisma.pushCampaignRun.delete({ where: { id } });
}

export async function getOverview(): Promise<PushOverview> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [active, devices, scheduled, recentRuns, marker] = await Promise.all([
    prisma.partner.count({ where: { status: 'ACTIVE' } }),
    prisma.pushDevice.findMany({ where: { partner: { status: 'ACTIVE' } }, select: { partnerId: true, platform: true } }),
    prisma.pushCampaign.count({ where: { status: 'SCHEDULED' } }),
    prisma.pushCampaignRun.count({ where: { startedAt: { gte: since }, status: 'sent' } }),
    prisma.systemHealth.findUnique({ where: { id: DISPATCHER_MARKER } }),
  ]);
  const android = new Set(devices.filter((d) => d.platform !== 'ios').map((d) => d.partnerId));
  const ios = new Set(devices.filter((d) => d.platform === 'ios').map((d) => d.partnerId));
  return {
    partners: { active, withDevice: new Set(devices.map((d) => d.partnerId)).size, android: android.size, ios: ios.size },
    devices: { android: devices.filter((d) => d.platform !== 'ios').length, ios: devices.filter((d) => d.platform === 'ios').length },
    scheduled,
    recentRuns,
    dispatcherSeenAt: marker?.checkedAt.toISOString() ?? null,
  };
}

/** A template sent to one partner (by partner code or mobile), exactly as partners will get it. */
export async function sendTestPush(templateId: string, who: string, platforms: PushPlatform[]) {
  const template = await getTemplate(templateId);
  const key = who.trim();
  const mobile = key.replace(/\D/g, '').slice(-10);
  const partner = await prisma.partner.findFirst({
    where: { OR: [{ partnerCode: { equals: key, mode: 'insensitive' } }, ...(mobile.length === 10 ? [{ mobile }] : [])] },
    select: { id: true, name: true, partnerCode: true },
  });
  if (!partner) throw new HttpError(404, 'No partner with that code or mobile number', 'PARTNER_NOT_FOUND');
  const totals = await deliver({ ...template, saveToInbox: true, platforms }, [partner.id]);
  return { partner, ...totals };
}
