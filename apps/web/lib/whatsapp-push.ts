import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { HttpError } from './auth';
import { WhatsAppProvider } from './messaging/whatsapp-provider';

/**
 * WhatsApp push messages: an MSG91 template sent once to every active partner's mobile number.
 * A template is added here when it is submitted in MSG91. The Super Admin turns it on in the
 * panel after MSG91 approves it; only then can it be sent.
 *
 * State lives in system_health rows (no schema change):
 *   wa-template:<name>  status 'on' | 'off'           — the approval switch
 *   wa-push:<name>      status 'sending' | 'running' | 'sent' — the send run and its progress
 */

export interface WhatsAppPushTemplate {
  name: string;
  title: string;
  language: string;
  /** MSG91's template id, for reference. */
  msg91TemplateId: number;
  body: string;
}

export const WHATSAPP_PUSH_TEMPLATES: WhatsAppPushTemplate[] = [
  {
    name: 'lmw_14_15_nov',
    title: '14–15 Nov weekend offer',
    language: 'en',
    msg91TemplateId: 610332,
    body: "🔥 *WARM GREETINGS FROM LOT MORE WINS!* 🙏✨\n\nDear LMW Partner,\n\n🎁 *EXCLUSIVE OFFERS FOR THIS WEEKEND(14th Nov & 15th Nov)*\n\n✅ *50% OFF* on bills above ₹1,000\n✅ *₹300 OFF* on bills above ₹700\n\n🍦 *BONUS TREAT!*\nShare your experience by giving us a Google Review and get a *FREE ICE CREAM!* \n\n📍 *VISIT OUR OUTLETS*\n\n1️⃣ *TDG*\nShop 1 & 2, R.S.345/3, ECR Road, Vanur Taluk, Near Jamiyath Nagar, Kottakuppam, Tamil Nadu – 605104.\n\n2️⃣ *HOPE CAFÉ – WHITE TOWN*\n4, Rue Suffren Street, White Town, Puducherry – 605001.\n\n3️⃣ *HOPE CAFÉ – AUROVILLE*\nAuroville Road, Kuilapalayam, Bommayapalayam, Tamil Nadu – 605101.\n\n💰 *CLAIM YOUR ELIGIBLE BENEFITS THROUGH LOT MORE WINS!*\n\nDon't miss out on this exciting opportunity to enjoy more while spending less!\n\nThank you for your love and support. We look forward to serving you again!\n\n❤️ *LOT MORE WINS*\n*Eat More. Enjoy More. Win More!*\n\nWith Love,\n*TEAM LOT MORE WINS*",
  },
];

/** One server call sends to at most this many partners, and stops early near the time budget. */
const BATCH_SIZE = 300;
const BATCH_TIME_MS = 40_000;
const PARALLEL = 8;
/** A batch that has not reported back in this long is treated as dead, so the run can resume. */
const STALE_RUN_MS = 90_000;
const MAX_LOGGED_ERRORS = 50;

export interface WhatsAppPushRun {
  status: 'sending' | 'sent';
  total: number;
  /** Partners handled so far, in sign-up order. */
  done: number;
  sent: number;
  failed: number;
  errors: { mobile: string; error: string }[];
  startedAt: string;
  startedBy: string;
  finishedAt: string | null;
}

export interface WhatsAppPushTemplateState extends WhatsAppPushTemplate {
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  run: WhatsAppPushRun | null;
  /** A batch is sending right now (another tab, or one that has not finished). */
  running: boolean;
}

export interface WhatsAppPushOverview {
  configured: boolean;
  recipients: number;
  templates: WhatsAppPushTemplateState[];
}

const switchId = (name: string) => `wa-template:${name}`;
const runId = (name: string) => `wa-push:${name}`;

export function findTemplate(name: string): WhatsAppPushTemplate {
  const template = WHATSAPP_PUSH_TEMPLATES.find((t) => t.name === name);
  if (!template) throw new HttpError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');
  return template;
}

const recipientWhere = { status: 'ACTIVE' } satisfies Prisma.PartnerWhereInput;

function readRun(row: { status: string; metadata: Prisma.JsonValue } | null): WhatsAppPushRun | null {
  if (!row || !row.metadata || typeof row.metadata !== 'object') return null;
  const run = row.metadata as unknown as WhatsAppPushRun;
  return { ...run, status: row.status === 'sent' ? 'sent' : 'sending' };
}

export async function getWhatsAppPushOverview(): Promise<WhatsAppPushOverview> {
  const names = WHATSAPP_PUSH_TEMPLATES.map((t) => t.name);
  const [rows, recipients] = await Promise.all([
    prisma.systemHealth.findMany({ where: { id: { in: [...names.map(switchId), ...names.map(runId)] } } }),
    prisma.partner.count({ where: recipientWhere }),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    configured: new WhatsAppProvider().isConfigured(),
    recipients,
    templates: WHATSAPP_PUSH_TEMPLATES.map((t) => {
      const sw = byId.get(switchId(t.name));
      const meta = (sw?.metadata ?? {}) as { by?: string };
      const run = byId.get(runId(t.name)) ?? null;
      return {
        ...t,
        approved: sw?.status === 'on',
        approvedAt: sw?.status === 'on' ? sw.checkedAt.toISOString() : null,
        approvedBy: sw?.status === 'on' ? (meta.by ?? null) : null,
        run: readRun(run),
        running: run?.status === 'running' && Date.now() - run.checkedAt.getTime() < STALE_RUN_MS,
      };
    }),
  };
}

/** The Super Admin's switch: on once the template is approved in MSG91. Turning it off also pauses a send. */
export async function setTemplateApproved(name: string, approved: boolean, adminName: string) {
  findTemplate(name);
  const data = { status: approved ? 'on' : 'off', checkedAt: new Date(), metadata: { by: adminName } };
  await prisma.systemHealth.upsert({ where: { id: switchId(name) }, create: { id: switchId(name), ...data }, update: data });
}

async function assertApproved(name: string) {
  const sw = await prisma.systemHealth.findUnique({ where: { id: switchId(name) } });
  if (sw?.status !== 'on') {
    throw new HttpError(409, 'Turn this template on first, once MSG91 has approved it.', 'TEMPLATE_NOT_APPROVED');
  }
}

function provider(): WhatsAppProvider {
  const wa = new WhatsAppProvider();
  if (!wa.isConfigured()) throw new HttpError(503, 'MSG91 WhatsApp is not configured on this server.', 'MSG91_NOT_CONFIGURED');
  return wa;
}

/** Sends the template to one number, to check it before sending to everyone. Works with the switch off too. */
export async function sendTestMessage(name: string, mobile: string) {
  const template = findTemplate(name);
  const result = await provider().sendTemplate(mobile, template.name, template.language);
  if (!result.success) throw new HttpError(502, `MSG91 did not send it: ${result.error ?? 'unknown error'}`, 'MSG91_SEND_FAILED');
  return { recipient: result.recipient };
}

/**
 * Sends the next batch of the run, starting the run on the first call. The panel calls this
 * again until `status` is 'sent', so no single request runs long. Partners are taken in
 * sign-up order, so partners who join during the run are reached at the end.
 */
export async function sendNextBatch(name: string, adminName: string): Promise<WhatsAppPushRun> {
  const template = findTemplate(name);
  await assertApproved(name);
  const wa = provider();
  const id = runId(name);

  // Start the run once; a second Send click joins the same run.
  const total = await prisma.partner.count({ where: recipientWhere });
  const fresh: WhatsAppPushRun = {
    status: 'sending',
    total,
    done: 0,
    sent: 0,
    failed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    startedBy: adminName,
    finishedAt: null,
  };
  if (!(await prisma.systemHealth.findUnique({ where: { id }, select: { id: true } }))) {
    try {
      await prisma.systemHealth.create({ data: { id, status: 'sending', metadata: fresh as unknown as Prisma.InputJsonValue } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }

  // Only one batch at a time: claim the run (or take over one whose batch died).
  const claimed = await prisma.systemHealth.updateMany({
    where: {
      id,
      OR: [{ status: 'sending' }, { status: 'running', checkedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } }],
    },
    data: { status: 'running', checkedAt: new Date() },
  });
  const row = await prisma.systemHealth.findUnique({ where: { id } });
  const run = readRun(row)!;
  if (row?.status === 'sent') return run;
  if (claimed.count === 0) throw new HttpError(409, 'A batch is already sending. Wait a moment.', 'SEND_IN_PROGRESS');

  const save = async (status: 'sending' | 'sent' | 'running') => {
    await prisma.systemHealth.update({
      where: { id },
      data: { status, checkedAt: new Date(), metadata: run as unknown as Prisma.InputJsonValue },
    });
  };

  try {
    const partners = await prisma.partner.findMany({
      where: recipientWhere,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: run.done,
      take: BATCH_SIZE,
      select: { mobile: true },
    });
    const started = Date.now();
    for (let i = 0; i < partners.length && Date.now() - started < BATCH_TIME_MS; i += PARALLEL) {
      const group = partners.slice(i, i + PARALLEL);
      const results = await Promise.all(group.map((p) => wa.sendTemplate(p.mobile, template.name, template.language)));
      results.forEach((r, k) => {
        if (r.success) run.sent++;
        else {
          run.failed++;
          if (run.errors.length < MAX_LOGGED_ERRORS) run.errors.push({ mobile: group[k].mobile, error: r.error ?? 'unknown error' });
        }
      });
      // Every one of the very first messages failed: the template is likely not approved yet, or MSG91
      // rejects it. Stop and forget the run, so it can start again from the beginning.
      if (run.done === 0 && run.sent === 0) {
        await prisma.systemHealth.delete({ where: { id } });
        throw new HttpError(502, `MSG91 rejected the first messages, so sending stopped: ${run.errors[0]?.error ?? 'unknown error'}`, 'MSG91_SEND_FAILED');
      }
      run.done += group.length;
      // Progress is kept as it goes, so a batch cut off by a timeout resumes without re-sending.
      await save('running');
    }

    const recipients = await prisma.partner.count({ where: recipientWhere });
    run.total = Math.max(recipients, run.done);
    if (run.done >= recipients) {
      run.status = 'sent';
      run.finishedAt = new Date().toISOString();
    }
    await save(run.status);
    return run;
  } catch (error) {
    // The row is gone when the run was abandoned above.
    if (!(error instanceof HttpError && error.code === 'MSG91_SEND_FAILED')) await save('sending').catch(() => undefined);
    throw error;
  }
}
