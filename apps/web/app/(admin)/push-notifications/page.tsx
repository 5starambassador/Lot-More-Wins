'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BellRing,
  CalendarClock,
  Copy,
  ExternalLink,
  FileText,
  History,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Smartphone,
  TestTube2,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { ApiResponse } from '@lotmorewins/types';
import { Badge, Tag, type Tone } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { PageHeader, Segmented } from '@/components/ui/page-header';
import { Panel, PanelBody } from '@/components/ui/panel';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { PushPreview } from '@/components/admin/push-preview';
import { adminApi, errorMessage, useAdminQuery } from '@/lib/admin-client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  APP_DESTINATIONS,
  BODY_LIMIT,
  describeAudience,
  describeSchedule,
  describeUrl,
  formatIst,
  isValidPushUrl,
  TITLE_LIMIT,
  type PushCampaignItem,
  type PushOverview,
  type PushRunItem,
  type PushTemplateItem,
} from '@/lib/push-engine-shared';

interface EngineData {
  overview: PushOverview;
  templates: PushTemplateItem[];
  campaigns: PushCampaignItem[];
  runs: PushRunItem[];
}

type Tab = 'templates' | 'scheduled' | 'history';

export default function PushNotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PushEngine />
    </Suspense>
  );
}

function PushEngine() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (['templates', 'scheduled', 'history'].includes(params.get('tab') ?? '') ? params.get('tab') : 'templates') as Tab;
  const setTab = (t: Tab) => router.replace(`/push-notifications${t === 'templates' ? '' : `?tab=${t}`}`, { scroll: false });
  const { data, error, loading, reload } = useAdminQuery(
    () => adminApi.get<ApiResponse<EngineData>>('/admin/push', { timeoutMs: 70_000 }).then((r) => r.data!),
    []
  );
  const [editing, setEditing] = useState<PushTemplateItem | 'new' | null>(null);
  const [copyFrom, setCopyFrom] = useState<PushTemplateItem | null>(null);

  const open = data?.campaigns.filter((c) => c.status === 'SCHEDULED' || c.status === 'PAUSED').length ?? 0;

  return (
    <>
      <PageHeader
        title="Push notifications"
        description="Write templates, then push them now or on a schedule (once, daily or weekly, IST) to all partners or to the ones you pick. Goes to the Partner App on Android and iPhone."
        actions={
          <Button
            onClick={() => {
              setCopyFrom(null);
              setEditing('new');
            }}
          >
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {loading && !data && <Skeleton className="h-96 w-full" />}
      {data && (
        <>
          <ReachStrip overview={data.overview} />
          <DispatcherNotice overview={data.overview} />
          <Segmented<Tab>
            label="Section"
            className="mb-4"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'templates', label: 'Templates', count: data.templates.length },
              { value: 'scheduled', label: 'Scheduled & recurring', count: open },
              { value: 'history', label: 'Send history', count: data.runs.length },
            ]}
          />
          {tab === 'templates' && (
            <Templates
              templates={data.templates}
              onEdit={setEditing}
              onDuplicate={(t) => {
                setCopyFrom(t);
                setEditing('new');
              }}
              reload={reload}
            />
          )}
          {tab === 'scheduled' && <Campaigns campaigns={data.campaigns} reload={reload} />}
          {tab === 'history' && <Runs runs={data.runs} reload={reload} />}
        </>
      )}
      <TemplateEditor
        open={editing !== null}
        template={editing === 'new' ? null : editing}
        copyFrom={copyFrom}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </>
  );
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-stone-150 bg-white px-4 py-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="tabular mt-1 text-xl font-semibold text-stone-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function ReachStrip({ overview: o }: { overview: PushOverview }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={BellRing} label="Active partners" value={formatNumber(o.partners.active)} hint="All of them get it in the app’s Notifications list" />
      <Stat
        icon={Smartphone}
        label="Reachable by push"
        value={formatNumber(o.partners.withDevice)}
        hint={`${formatNumber(o.partners.android)} Android · ${formatNumber(o.partners.ios)} iPhone`}
      />
      <Stat icon={CalendarClock} label="Scheduled" value={formatNumber(o.scheduled)} hint="Campaigns waiting to send" />
      <Stat icon={History} label="Sends, last 30 days" value={formatNumber(o.recentRuns)} />
    </div>
  );
}

/** Scheduled sends need something to call the dispatcher; warn when nothing has for a while. */
function DispatcherNotice({ overview: o }: { overview: PushOverview }) {
  if (o.scheduled === 0) return null;
  const seen = o.dispatcherSeenAt ? Date.parse(o.dispatcherSeenAt) : 0;
  const minutes = (Date.now() - seen) / 60_000;
  if (minutes < 20) return null;
  return (
    <Alert tone="warning" className="mb-5" title="Scheduled pushes depend on the dispatcher">
      It last ran {seen ? `${Math.round(minutes)} minutes ago` : 'never'} (opening this page also runs it). Make sure the
      scheduler calls <span className="font-mono">/api/cron/push-campaigns</span> every few minutes, or scheduled sends will be late
      or missed (a send more than 2 hours late is skipped).
    </Alert>
  );
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

function Templates({
  templates,
  onEdit,
  onDuplicate,
  reload,
}: {
  templates: PushTemplateItem[];
  onEdit: (t: PushTemplateItem) => void;
  onDuplicate: (t: PushTemplateItem) => void;
  reload: () => void;
}) {
  const toast = useToast();
  const [deleting, setDeleting] = useState<PushTemplateItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<PushTemplateItem | null>(null);

  if (templates.length === 0)
    return <EmptyState icon={FileText} title="No templates yet" description="Create a template with “New template”, then push it now or schedule it." />;

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminApi.delete(`/admin/push/templates/${deleting.id}`);
      toast('success', 'Template deleted');
      setDeleting(null);
      reload();
    } catch (err) {
      toast('error', 'Not deleted', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((t) => (
          <Panel key={t.id} className="flex flex-col">
            <PanelBody className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">{t.name}</p>
                  <p className="mt-1 text-[15px] font-semibold text-stone-900">{t.title}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label="Edit" icon={Pencil} onClick={() => onEdit(t)} />
                  <IconButton label="Duplicate" icon={Copy} onClick={() => onDuplicate(t)} />
                  <IconButton label="Send a test" icon={TestTube2} onClick={() => setTesting(t)} />
                  <IconButton label="Delete" icon={Trash2} onClick={() => setDeleting(t)} danger />
                </div>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-stone-700">{t.body}</p>
              <div className="flex flex-wrap gap-1.5">
                <Tag>
                  <ExternalLink className="mr-1 h-3 w-3" /> {describeUrl(t.url)}
                </Tag>
                {t.detail && <Tag gold>Full message page</Tag>}
                <Tag>
                  {t.campaigns === 0 ? 'Never sent' : `${formatNumber(t.campaigns)} campaign${t.campaigns === 1 ? '' : 's'}`}
                  {t.lastSentAt ? ` · last ${formatIst(t.lastSentAt)}` : ''}
                </Tag>
              </div>
            </PanelBody>
            <div className="flex flex-wrap gap-2 border-t border-stone-150 bg-stone-25 px-5 py-3">
              <Link href={`/push-notifications/send?template=${t.id}&mode=now`} className={buttonClass('primary', 'sm')}>
                <Send className="h-3.5 w-3.5" /> Push now
              </Link>
              <Link href={`/push-notifications/send?template=${t.id}&mode=schedule`} className={buttonClass('secondary', 'sm')}>
                <CalendarClock className="h-3.5 w-3.5" /> Schedule
              </Link>
              <span className="ml-auto self-center text-[11px] text-stone-400">Edited {formatIst(t.updatedAt)} · {t.createdBy}</span>
            </div>
          </Panel>
        ))}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title="Delete this template?"
        description={`“${deleting?.name}” is removed from the list. Scheduled campaigns made from it keep sending; cancel them under “Scheduled & recurring”.`}
        confirmLabel="Delete"
      />
      <TestDialog template={testing} onClose={() => setTesting(null)} />
    </>
  );
}

function IconButton({ label, icon: Icon, onClick, danger }: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100', danger ? 'hover:text-red-700' : 'hover:text-stone-900')}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function TestDialog({ template, onClose }: { template: PushTemplateItem | null; onClose: () => void }) {
  const toast = useToast();
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!template) return;
    setBusy(true);
    try {
      const res = await adminApi.post<ApiResponse<{ partner: { name: string; partnerCode: string }; devices: number; accepted: number; errors: Record<string, number> }>>(
        `/admin/push/templates/${template.id}/test`,
        { partner: who }
      );
      const r = res.data!;
      if (r.devices === 0) toast('success', 'Added to their Notifications list', `${r.partner.name} (${r.partner.partnerCode}) has no device registered for push.`);
      else if (r.accepted > 0) toast('success', 'Test push sent', `To ${r.partner.name} (${r.partner.partnerCode}) on ${r.accepted} of ${r.devices} device(s).`);
      else toast('error', 'Push not accepted', Object.keys(r.errors).join(', ') || 'Expo did not accept it.');
      onClose();
    } catch (err) {
      toast('error', 'Test not sent', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ConfirmDialog
      open={!!template}
      onClose={onClose}
      onConfirm={send}
      busy={busy}
      title="Send a test"
      description="Sends this template to one partner only, exactly as everyone gets it (it is also added to their Notifications list). Use your own partner account."
      confirmLabel="Send test"
      confirmDisabled={who.trim().length < 3}
    >
      <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Partner code or mobile number" autoFocus />
    </ConfirmDialog>
  );
}

function TemplateEditor({
  open,
  template,
  copyFrom,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: PushTemplateItem | null;
  copyFrom: PushTemplateItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const source = template ?? copyFrom;
  const [form, setForm] = useState({ name: '', title: '', body: '', detail: '', url: '' });
  const [urlMode, setUrlMode] = useState<'app' | 'custom'>('app');
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the form when the drawer opens for a (different) template.
  const key = open ? `${template?.id ?? 'new'}:${copyFrom?.id ?? ''}` : null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    if (key) {
      const url = source?.url ?? '';
      setForm({
        name: source ? (template ? source.name : `${source.name} (copy)`) : '',
        title: source?.title ?? '',
        body: source?.body ?? '',
        detail: source?.detail ?? '',
        url,
      });
      setUrlMode(!url || APP_DESTINATIONS.some((d) => d.value === url) ? 'app' : 'custom');
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const urlError = form.url.trim() && !isValidPushUrl(form.url.trim()) ? 'Use an app page such as /wallet or /outlet/<id>, or a web link starting with https://' : null;

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, detail: form.detail || null, url: form.url.trim() || null };
      if (template) await adminApi.put(`/admin/push/templates/${template.id}`, payload);
      else await adminApi.post('/admin/push/templates', payload);
      toast('success', template ? 'Template saved' : 'Template created');
      onSaved();
    } catch (err) {
      toast('error', 'Not saved', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const textarea =
    'w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-900 placeholder:text-stone-400 hover:border-stone-300 focus:border-gold-500 focus:outline-none focus:ring-[3px] focus:ring-gold-400/20';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={template ? 'Edit template' : 'New template'}
      subtitle={template ? 'Campaigns already scheduled keep the message they were made with.' : 'Write it once, push it as often as you like.'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!form.name.trim() || !form.title.trim() || !form.body.trim() || !!urlError}>
            {template ? 'Save template' : 'Create template'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <Field label="Template name" required hint="Only you see this, e.g. “Weekend offer – Saturday morning”.">
          <Input value={form.name} onChange={set('name')} maxLength={80} />
        </Field>
        <Field
          label="Title"
          required
          hint={<Counter n={form.title.length} limit={TITLE_LIMIT} note="Longer titles are cut off on the lock screen." />}
        >
          <Input value={form.title} onChange={set('title')} maxLength={120} placeholder="🔥 Tonight: 50% OFF + FREE Ice Cream!" />
        </Field>
        <Field label="Message" required hint={<Counter n={form.body.length} limit={BODY_LIMIT} note="Phones show about this much before “more”." />}>
          <textarea value={form.body} onChange={set('body')} maxLength={500} rows={4} className={textarea} />
        </Field>
        <Field
          label="Full message (optional)"
          hint="Shown on the notification’s own page in the app. *Text between asterisks* shows bold, like WhatsApp."
        >
          <textarea value={form.detail} onChange={set('detail')} maxLength={5000} rows={6} className={textarea} />
        </Field>
        <Field label="When tapped, open" error={urlError}>
          <div className="space-y-2">
            <Segmented
              label="Link type"
              value={urlMode}
              onChange={(m) => {
                setUrlMode(m);
                setForm((f) => ({ ...f, url: '' }));
              }}
              options={[
                { value: 'app', label: 'A page in the app' },
                { value: 'custom', label: 'Web link / custom route' },
              ]}
            />
            {urlMode === 'app' ? (
              <Select value={form.url} onChange={set('url')}>
                {APP_DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={form.url} onChange={set('url')} placeholder="https://lotmorewins.com/offers  or  /outlet/<outlet id>" maxLength={500} />
            )}
          </div>
        </Field>
        <PushPreview title={form.title} body={form.body} detail={form.detail} url={form.url.trim() || null} className="rounded-lg border border-stone-150 p-4" />
        <p className="text-xs text-stone-500">
          Partners on app versions before the redirect update still get the push; tapping it opens their Notifications list.
        </p>
      </div>
    </Drawer>
  );
}

function Counter({ n, limit, note }: { n: number; limit: number; note: string }) {
  return (
    <span className={cn(n > limit && 'text-amber-700')}>
      {n}/{limit} characters{n > limit ? ` · ${note}` : ''}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Campaigns
// ----------------------------------------------------------------------------

const STATUS: Record<PushCampaignItem['status'], { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

function platformsText(p: string[]) {
  return p.length === 2 ? 'Android + iPhone' : p[0] === 'ios' ? 'iPhone' : 'Android';
}

function Campaigns({ campaigns, reload }: { campaigns: PushCampaignItem[]; reload: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ c: PushCampaignItem; action: 'cancel' | 'sendNow' } | null>(null);
  const [runsOf, setRunsOf] = useState<PushCampaignItem | null>(null);
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = show === 'open' ? campaigns.filter((c) => c.status === 'SCHEDULED' || c.status === 'PAUSED') : campaigns;

  async function act(c: PushCampaignItem, action: 'pause' | 'resume' | 'cancel' | 'sendNow') {
    setBusy(`${c.id}:${action}`);
    try {
      const res = await adminApi.patch<ApiResponse<{ run: PushRunItem | null }>>(`/admin/push/campaigns/${c.id}`, { action }, { timeoutMs: 70_000 });
      const run = res.data!.run;
      toast('success', res.message ?? 'Done', run ? `${formatNumber(run.accepted)} push(es) accepted for ${formatNumber(run.partners)} partners.` : undefined);
      setConfirm(null);
      reload();
    } catch (err) {
      toast('error', 'Not changed', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b border-stone-150 px-5 py-3">
        <Segmented
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: 'open', label: 'Upcoming' },
            { value: 'all', label: 'All campaigns' },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={show === 'open' ? 'Nothing scheduled' : 'No campaigns yet'}
          description="Open a template and choose “Schedule” to send it later, every day or every week."
        />
      ) : (
        <TableScroll>
          <Table>
            <THead>
              <tr>
                <TH>Message</TH>
                <TH>Schedule</TH>
                <TH>Audience</TH>
                <TH>Next send</TH>
                <TH>Last send</TH>
                <TH>Status</TH>
                <TH align="right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {list.map((c) => (
                <TR key={c.id}>
                  <TD className="max-w-[260px]">
                    <p className="truncate font-medium text-stone-900">{c.title}</p>
                    <p className="truncate text-xs text-stone-500">{c.templateName ?? 'Template deleted'} · {c.createdBy}</p>
                  </TD>
                  <TD className="min-w-[180px] text-xs">{describeSchedule(c)}</TD>
                  <TD className="min-w-[180px] text-xs">
                    {describeAudience(c.audience, c.audienceSize)}
                    <p className="text-stone-500">
                      {platformsText(c.platforms)}
                      {c.saveToInbox ? ' · + Notifications list' : ' · push only'}
                    </p>
                  </TD>
                  <TD className="whitespace-nowrap text-xs">{c.nextRunAt ? formatIst(c.nextRunAt) : '—'}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    {c.lastRun ? (
                      <button type="button" className="text-left hover:text-maroon-700" onClick={() => setRunsOf(c)}>
                        {formatIst(c.lastRun.startedAt)}
                        <span className="block text-stone-500">
                          {c.lastRun.status === 'sent'
                            ? `${formatNumber(c.lastRun.accepted)} pushes · ${formatNumber(c.lastRun.partners)} partners`
                            : c.lastRun.status}
                          {c.runCount > 1 ? ` · ${c.runCount} sends` : ''}
                        </span>
                      </button>
                    ) : (
                      '—'
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  </TD>
                  <TD align="right" className="whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      {c.status === 'SCHEDULED' && (
                        <Button size="sm" variant="ghost" loading={busy === `${c.id}:pause`} onClick={() => act(c, 'pause')} title="Pause">
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {c.status === 'PAUSED' && (
                        <Button size="sm" variant="ghost" loading={busy === `${c.id}:resume`} onClick={() => act(c, 'resume')} title="Resume">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ c, action: 'sendNow' })} title="Send once more now">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRunsOf(c)} title="Send history">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      {(c.status === 'SCHEDULED' || c.status === 'PAUSED') && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirm({ c, action: 'cancel' })} title="Cancel" className="hover:text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act(confirm.c, confirm.action)}
        busy={!!busy}
        tone={confirm?.action === 'cancel' ? 'danger' : 'primary'}
        title={confirm?.action === 'cancel' ? 'Cancel this campaign?' : 'Send it once more, now?'}
        description={
          confirm?.action === 'cancel'
            ? 'No more sends will go out. Sends already made are kept in the history.'
            : `“${confirm?.c.title}” goes to its audience now. Its schedule is not changed.`
        }
        confirmLabel={confirm?.action === 'cancel' ? 'Cancel campaign' : 'Send now'}
      />
      <RunsDrawer campaign={runsOf} onClose={() => setRunsOf(null)} onChanged={reload} />
    </Panel>
  );
}

function RunsDrawer({ campaign, onClose, onChanged }: { campaign: PushCampaignItem | null; onClose: () => void; onChanged: () => void }) {
  const { data, loading, reload } = useAdminQuery(
    () => (campaign ? adminApi.get<ApiResponse<PushRunItem[]>>(`/admin/push/campaigns/${campaign.id}`).then((r) => r.data!) : Promise.resolve([])),
    [campaign?.id]
  );
  return (
    <Drawer open={!!campaign} onClose={onClose} title={campaign?.title ?? ''} subtitle={campaign ? describeSchedule(campaign) : ''}>
      {campaign && (
        <div className="space-y-5 px-6 py-5">
          <PushPreview title={campaign.title} body={campaign.body} detail={campaign.detail} url={campaign.url} />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Sends</p>
            {loading && !data ? <Skeleton className="h-32 w-full" /> : (
              <DeletableRunList
                runs={data ?? []}
                compact
                onDeleted={() => {
                  reload();
                  onChanged();
                }}
              />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ----------------------------------------------------------------------------
// History
// ----------------------------------------------------------------------------

const RUN_TONE: Record<PushRunItem['status'], Tone> = { sent: 'success', sending: 'warning', failed: 'danger', missed: 'danger' };

/** A run list whose rows can each be removed from the history, after a confirm. */
function DeletableRunList({ runs, compact, onDeleted }: { runs: PushRunItem[]; compact?: boolean; onDeleted: () => void }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState<PushRunItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminApi.delete(`/admin/push/runs/${deleting.id}`);
      toast('success', 'Removed from the history');
      setDeleting(null);
      onDeleted();
    } catch (err) {
      toast('error', 'Not removed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RunList runs={runs} compact={compact} onDelete={setDeleting} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title="Remove this send from the history?"
        description={
          deleting
            ? `“${deleting.title}” sent ${formatIst(deleting.startedAt)} to ${formatNumber(deleting.partners)} partners. Pushes already delivered, and their Notifications-list entries, stay with the partners. The campaign itself is not changed.`
            : undefined
        }
        confirmLabel="Remove"
      />
    </>
  );
}

function RunList({ runs, compact, onDelete }: { runs: PushRunItem[]; compact?: boolean; onDelete?: (r: PushRunItem) => void }) {
  if (runs.length === 0) return <p className="text-[13px] text-stone-500">Nothing sent yet.</p>;
  return (
    <TableScroll>
      <Table>
        <THead>
          <tr>
            <TH>When</TH>
            {!compact && <TH>Message</TH>}
            <TH align="right">Partners</TH>
            <TH align="right">Devices</TH>
            <TH align="right">Accepted</TH>
            <TH>Status</TH>
            {onDelete && (
              <TH align="right">
                <span className="sr-only">Delete</span>
              </TH>
            )}
          </tr>
        </THead>
        <TBody>
          {runs.map((r) => {
            const errors = Object.entries(r.errors);
            return (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-xs">
                  {formatIst(r.startedAt)}
                  {Math.abs(Date.parse(r.startedAt) - Date.parse(r.scheduledFor)) > 5 * 60_000 && (
                    <span className="block text-stone-500">due {formatIst(r.scheduledFor)}</span>
                  )}
                </TD>
                {!compact && <TD className="max-w-[320px] truncate">{r.title}</TD>}
                <TD align="right">{formatNumber(r.partners)}</TD>
                <TD align="right">{formatNumber(r.devices)}</TD>
                <TD align="right">{formatNumber(r.accepted)}</TD>
                <TD>
                  <Badge tone={RUN_TONE[r.status]}>{r.status}</Badge>
                  {errors.length > 0 && (
                    <span className="mt-1 block text-[11px] text-stone-500" title="Expo error codes">
                      {errors.map(([k, v]) => `${k} ×${v}`).join(', ')}
                    </span>
                  )}
                </TD>
                {onDelete && (
                  <TD align="right">
                    <IconButton label="Delete from history" icon={Trash2} onClick={() => onDelete(r)} danger />
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}

function Runs({ runs, reload }: { runs: PushRunItem[]; reload: () => void }) {
  return (
    <Panel>
      {runs.length === 0 ? (
        <EmptyState icon={History} title="No pushes sent yet" description="Every send, now or scheduled, is listed here with how many phones accepted it." />
      ) : (
        <DeletableRunList runs={runs} onDeleted={reload} />
      )}
      <p className="border-t border-stone-150 px-5 py-3 text-xs text-stone-500">
        Partners = who it was for (all get it in the app’s Notifications list when that is on). Devices = phones with notifications on.
        Accepted = pushes Expo accepted for Android (FCM) and iPhone (APNs). DeviceNotRegistered means the app was uninstalled; that
        device is removed.
      </p>
    </Panel>
  );
}
