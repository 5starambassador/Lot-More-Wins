'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, ChevronDown, ChevronRight, Filter, Search, Send, Smartphone, Users, X } from 'lucide-react';
import type { ApiResponse } from '@lotmorewins/types';
import { Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { PageHeader, Segmented } from '@/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { PushPreview } from '@/components/admin/push-preview';
import { adminApi, errorMessage, useAdminQuery } from '@/lib/admin-client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FILTER,
  describeSchedule,
  formatIst,
  GROUP_OPTIONS,
  groupAudience,
  isPlainFilter,
  istDay,
  matchesFilter,
  nextOccurrence,
  WEEKDAYS,
  type Audience,
  type AudienceFilter,
  type AudienceRow,
  type GroupBy,
  type PushPlatform,
  type PushRunItem,
  type PushScheduleType,
  type PushTemplateItem,
  type Range,
  type ScheduleSpec,
} from '@/lib/push-engine-shared';

const CONFIRM_WORD = 'SEND';
/** Rows drawn per group before "Show all", to keep the page quick with thousands of partners. */
const ROWS_PER_GROUP = 100;

export default function SendPushPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SendPush />
    </Suspense>
  );
}

function SendPush() {
  const params = useSearchParams();
  const templateId = params.get('template') ?? '';
  const scheduling = params.get('mode') === 'schedule';

  const template = useAdminQuery(() => adminApi.get<ApiResponse<PushTemplateItem>>(`/admin/push/templates/${templateId}`).then((r) => r.data!), [templateId]);
  const audience = useAdminQuery(() => adminApi.get<ApiResponse<AudienceRow[]>>('/admin/push/audience', { timeoutMs: 60_000 }).then((r) => r.data!), []);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Push notifications', href: '/push-notifications' }, { label: scheduling ? 'Schedule' : 'Push now' }]}
        title={scheduling ? 'Schedule a push' : 'Push now'}
        description="Choose who gets it: select everyone, a group, or single partners. Filter and group by registration date, referrals, bills and devices."
      />
      {(template.error || audience.error) && (
        <Alert tone="danger" className="mb-4">
          {template.error ?? audience.error}
        </Alert>
      )}
      {(!template.data || !audience.data) && !template.error && !audience.error && <Skeleton className="h-96 w-full" />}
      {template.data && audience.data && <Composer template={template.data} rows={audience.data} scheduling={scheduling} />}
    </>
  );
}

// ----------------------------------------------------------------------------

function Composer({ template, rows, scheduling }: { template: PushTemplateItem; rows: AudienceRow[]; scheduling: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [filter, setFilter] = useState<AudienceFilter>(DEFAULT_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [platforms, setPlatforms] = useState<PushPlatform[]>(['android', 'ios']);
  const [saveToInbox, setSaveToInbox] = useState(true);
  const [audienceMode, setAudienceMode] = useState<'fixed' | 'live'>('fixed');
  const [schedule, setSchedule] = useState<ScheduleSpec>(() => ({
    type: scheduling ? 'ONCE' : 'NOW',
    sendAt: null,
    timeOfDay: '10:00',
    weekdays: [6, 0],
    startDate: istDay(new Date()),
    endDate: null,
  }));
  const [sendAtLocal, setSendAtLocal] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [sending, setSending] = useState(false);

  // Fixed while the page is open, so the lists are not recalculated on every keystroke.
  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => rows.filter((r) => matchesFilter(r, filter, now)), [rows, filter, now]);
  const groups = useMemo(() => groupAudience(filtered, groupBy, now), [filtered, groupBy, now]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const cities = useMemo(
    () => [...new Set(rows.map((r) => r.city?.trim()).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const exactlyFiltered = allFilteredSelected && selected.size === filtered.length;
  const chosen = [...selected].map((id) => byId.get(id)).filter((r): r is AudienceRow => !!r);
  const activeChosen = chosen.filter((r) => r.status === 'ACTIVE');
  const hiddenSelected = chosen.length - chosen.filter((r) => matchesFilter(r, filter, now)).length;
  const reach = {
    android: activeChosen.filter((r) => r.androidDevices > 0).length,
    ios: activeChosen.filter((r) => r.iosDevices > 0).length,
    push: activeChosen.filter((r) => (platforms.includes('android') && r.androidDevices > 0) || (platforms.includes('ios') && r.iosDevices > 0)).length,
  };
  const liveAvailable = exactlyFiltered;
  const useLive = liveAvailable && audienceMode === 'live';

  function toggle(ids: string[], on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  const effectiveSchedule: ScheduleSpec = {
    ...schedule,
    sendAt: schedule.type === 'ONCE' && sendAtLocal ? new Date(`${sendAtLocal}:00+05:30`).toISOString() : null,
  };
  const firstSend = schedule.type === 'NOW' ? new Date() : nextOccurrence(effectiveSchedule, new Date());
  const scheduleError =
    schedule.type === 'ONCE' && !sendAtLocal
      ? 'Choose the date and time'
      : schedule.type === 'WEEKLY' && !schedule.weekdays?.length
        ? 'Choose at least one weekday'
        : schedule.type !== 'NOW' && !firstSend
          ? 'That time has passed (or the end date is before the next send)'
          : null;

  const audience: Audience = useLive
    ? isPlainFilter(filter)
      ? { kind: 'all' }
      : { kind: 'filter', filter }
    : { kind: 'partners', ids: activeChosen.map((r) => r.id) };
  const canSend = activeChosen.length > 0 && platforms.length > 0 && !scheduleError && !sending;

  async function submit() {
    setSending(true);
    try {
      const res = await adminApi.post<ApiResponse<{ run: PushRunItem | null }>>(
        '/admin/push/campaigns',
        {
          templateId: template.id,
          audience,
          platforms,
          saveToInbox,
          schedule: {
            type: effectiveSchedule.type,
            sendAt: effectiveSchedule.sendAt,
            timeOfDay: effectiveSchedule.timeOfDay,
            weekdays: effectiveSchedule.weekdays,
            startDate: effectiveSchedule.startDate || null,
            endDate: effectiveSchedule.endDate || null,
          },
        },
        { timeoutMs: 120_000 }
      );
      const run = res.data!.run;
      if (run)
        toast(
          run.status === 'sent' ? 'success' : 'error',
          run.status === 'sent' ? 'Push sent' : 'Sending failed',
          `${formatNumber(run.partners)} partners · ${formatNumber(run.accepted)} of ${formatNumber(run.devices)} devices accepted.`
        );
      else toast('success', 'Push scheduled', firstSend ? `First send ${formatIst(firstSend)} IST.` : undefined);
      router.push(run ? '/push-notifications?tab=history' : '/push-notifications?tab=scheduled');
    } catch (err) {
      toast('error', 'Not sent', errorMessage(err));
      setSending(false);
    }
    setConfirmOpen(false);
    setTyped('');
  }

  const filterCount = countFilters(filter);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Partner list */}
      <Panel className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-stone-150 px-5 py-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Input
              icon={Search}
              value={filter.search ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search name, partner code, mobile, city"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-stone-600">
              Group by
              <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="w-[230px]">
                {GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant={showFilters || filterCount ? 'secondary' : 'ghost'} onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters{filterCount ? ` (${filterCount})` : ''}
            </Button>
          </div>
        </div>

        {showFilters && <Filters filter={filter} onChange={setFilter} cities={cities} />}

        <div className="flex flex-wrap items-center gap-3 border-b border-stone-150 bg-stone-25 px-5 py-2.5 text-[13px]">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-stone-900">
            <Checkbox checked={allFilteredSelected} indeterminate={!allFilteredSelected && filtered.some((r) => selected.has(r.id))} onChange={(on) => toggle(filtered.map((r) => r.id), on)} />
            Select all {formatNumber(filtered.length)} {filterCount ? 'matching ' : ''}partners
          </label>
          <span className="text-stone-500">·</span>
          <span className="tabular text-stone-700">
            <span className="font-semibold text-maroon-700">{formatNumber(selected.size)}</span> selected
          </span>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          {hiddenSelected > 0 && <span className="text-xs text-amber-700">{formatNumber(hiddenSelected)} selected are hidden by the filters</span>}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No partners match" description="Change or clear the filters." />
        ) : (
          <TableScroll className="max-h-[70vh] overflow-y-auto">
            <Table>
              <THead className="sticky top-0 z-10">
                <tr>
                  <TH className="w-10" />
                  <TH>Partner</TH>
                  <TH>Joined</TH>
                  <TH align="right" title="Partners who registered with this partner as “Referred by”">Reg. referrals</TH>
                  <TH align="right" title="Bills paid by friends using this partner’s Referral QR">Referral QR bills</TH>
                  <TH align="right" title="The partner’s own bills with the Personal Discount QR">Personal bills</TH>
                  <TH align="right">Redeem bills</TH>
                  <TH>Last bill</TH>
                  <TH>Devices</TH>
                </tr>
              </THead>
              {groups.map((g) => (
                <GroupRows key={g.key} label={g.label} rows={g.rows} grouped={groupBy !== 'none'} selected={selected} toggle={toggle} />
              ))}
            </Table>
          </TableScroll>
        )}
      </Panel>

      {/* Message, schedule and send */}
      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Panel>
          <PanelHeader eyebrow={template.name} title="Message" />
          <PanelBody>
            <PushPreview title={template.title} body={template.body} detail={template.detail} url={template.url} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title={scheduling ? 'When' : 'Send'} />
          <PanelBody className="space-y-4">
            {scheduling && <ScheduleEditor schedule={schedule} onChange={setSchedule} sendAtLocal={sendAtLocal} onSendAt={setSendAtLocal} />}

            <Field label="Platforms">
              <div className="flex gap-4 text-[13px]">
                {(['android', 'ios'] as const).map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={platforms.includes(p)}
                      onChange={(on) => setPlatforms((ps) => (on ? [...new Set([...ps, p])] : ps.filter((x) => x !== p)))}
                    />
                    {p === 'android' ? 'Android' : 'iPhone (iOS)'}
                  </label>
                ))}
              </div>
            </Field>

            <label className="flex cursor-pointer items-start gap-2 text-[13px]">
              <Checkbox checked={saveToInbox} onChange={setSaveToInbox} />
              <span>
                Also add it to the app’s Notifications list
                <span className="block text-xs text-stone-500">Partners without push (no device, notifications off) still see it there.</span>
              </span>
            </label>

            {liveAvailable && (
              <Field label="Audience at each send">
                <Segmented
                  label="Audience"
                  value={audienceMode}
                  onChange={setAudienceMode}
                  options={[
                    { value: 'fixed', label: 'These partners' },
                    { value: 'live', label: isPlainFilter(filter) ? 'All active, always' : 'Re-apply filters' },
                  ]}
                />
                <p className="text-xs text-stone-500">
                  {audienceMode === 'fixed'
                    ? `Exactly the ${formatNumber(activeChosen.length)} partners selected now.`
                    : 'Checked again at every send, so partners who join or start matching later are included.'}
                </p>
              </Field>
            )}

            <div className="rounded-md bg-stone-50 px-3 py-2.5 text-[13px]">
              <p className="tabular font-medium text-stone-900">
                {formatNumber(activeChosen.length)} partner{activeChosen.length === 1 ? '' : 's'}
              </p>
              <p className="tabular mt-0.5 flex items-center gap-1 text-xs text-stone-600">
                <Smartphone className="h-3.5 w-3.5" /> {formatNumber(reach.push)} get a push now ({formatNumber(reach.android)} Android · {formatNumber(reach.ios)} iPhone)
              </p>
              {chosen.length > activeChosen.length && (
                <p className="mt-1 text-xs text-amber-700">{formatNumber(chosen.length - activeChosen.length)} selected are not active and will be skipped.</p>
              )}
              {schedule.type !== 'NOW' && firstSend && <p className="mt-1 text-xs text-stone-600">First send: {formatIst(firstSend)} IST</p>}
            </div>

            {scheduleError && schedule.type !== 'NOW' && <p className="text-xs text-red-700">{scheduleError}</p>}
            <Button className="w-full" size="lg" disabled={!canSend} loading={sending} onClick={() => setConfirmOpen(true)}>
              {schedule.type === 'NOW' ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
              {schedule.type === 'NOW' ? `Push to ${formatNumber(activeChosen.length)} partners` : 'Schedule push'}
            </Button>
            {activeChosen.length === 0 && <p className="text-center text-xs text-stone-500">Select partners in the list to continue.</p>}
          </PanelBody>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setTyped('');
        }}
        onConfirm={submit}
        busy={sending}
        title={schedule.type === 'NOW' ? `Push to ${formatNumber(activeChosen.length)} partners now?` : 'Schedule this push?'}
        description={
          <>
            “{template.title}” · {describeSchedule(effectiveSchedule)} · {platforms.map((p) => (p === 'ios' ? 'iPhone' : 'Android')).join(' + ')}
            {useLive ? ' · audience re-checked at each send' : ''}.
            {schedule.type === 'NOW' && <> This cannot be undone. Type {CONFIRM_WORD} to confirm.</>}
          </>
        }
        confirmLabel={schedule.type === 'NOW' ? 'Push now' : 'Schedule'}
        confirmDisabled={schedule.type === 'NOW' && typed.trim().toUpperCase() !== CONFIRM_WORD}
      >
        {schedule.type === 'NOW' && <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD} autoFocus />}
      </ConfirmDialog>
    </div>
  );
}

// ----------------------------------------------------------------------------

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: (on: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-stone-300 accent-maroon-700"
    />
  );
}

function GroupRows({
  label,
  rows,
  grouped,
  selected,
  toggle,
}: {
  label: string;
  rows: AudienceRow[];
  grouped: boolean;
  selected: Set<string>;
  toggle: (ids: string[], on: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [limit, setLimit] = useState(ROWS_PER_GROUP);
  const ids = rows.map((r) => r.id);
  const count = ids.filter((id) => selected.has(id)).length;
  const shown = open ? rows.slice(0, limit) : [];
  return (
    <TBody>
      {grouped && (
        <tr className="bg-maroon-50/40">
          <td className="h-10 pl-5">
            <Checkbox checked={count === rows.length} indeterminate={count > 0 && count < rows.length} onChange={(on) => toggle(ids, on)} />
          </td>
          <td colSpan={8} className="pr-5">
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-stone-900">
              {open ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronRight className="h-4 w-4 text-stone-400" />}
              {label}
              <Tag className="tabular">{formatNumber(rows.length)}</Tag>
              {count > 0 && <span className="tabular text-xs font-normal text-maroon-700">{formatNumber(count)} selected</span>}
            </button>
          </td>
        </tr>
      )}
      {shown.map((r) => (
        <TR key={r.id} interactive onClick={() => toggle([r.id], !selected.has(r.id))} className={cn(selected.has(r.id) && 'bg-gold-50/50')}>
          <TD onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={selected.has(r.id)} onChange={(on) => toggle([r.id], on)} />
          </TD>
          <TD className="min-w-[200px]">
            <p className="font-medium text-stone-900">
              {r.name}
              {r.status !== 'ACTIVE' && <Tag className="ml-2">{r.status.toLowerCase()}</Tag>}
              {r.category === 'ACHARIYA' && <Tag gold className="ml-2">Achariya</Tag>}
            </p>
            <p className="text-xs text-stone-500">
              {r.partnerCode} · {r.mobile}
              {r.city ? ` · ${r.city}` : ''}
            </p>
          </TD>
          <TD className="whitespace-nowrap text-xs">{new Date(r.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</TD>
          <TD align="right">{r.registeredReferrals}</TD>
          <TD align="right">{r.referralBills}</TD>
          <TD align="right">{r.personalBills}</TD>
          <TD align="right">{r.redeemBills}</TD>
          <TD className="whitespace-nowrap text-xs">
            {r.lastBillAt ? new Date(r.lastBillAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '—'}
          </TD>
          <TD className="whitespace-nowrap text-xs">
            {r.androidDevices + r.iosDevices === 0 ? (
              <span className="text-stone-400">none</span>
            ) : (
              [r.androidDevices > 0 && 'Android', r.iosDevices > 0 && 'iPhone'].filter(Boolean).join(' + ')
            )}
          </TD>
        </TR>
      ))}
      {open && rows.length > limit && (
        <tr>
          <td colSpan={9} className="px-5 py-2 text-center">
            <Button size="sm" variant="ghost" onClick={() => setLimit(rows.length)}>
              Show all {formatNumber(rows.length)} (showing {formatNumber(limit)})
            </Button>
          </td>
        </tr>
      )}
    </TBody>
  );
}

// ----------------------------------------------------------------------------

function countFilters(f: AudienceFilter): number {
  const ranges = [f.registeredReferrals, f.referralBills, f.personalBills, f.redeemBills].filter((r) => r && (r.min !== undefined || r.max !== undefined)).length;
  const statuses = f.statuses ?? [];
  return (
    ranges +
    (statuses.length === 1 && statuses[0] === 'ACTIVE' ? 0 : 1) +
    (f.categories?.length ? 1 : 0) +
    (f.cities?.length ? 1 : 0) +
    (f.joinedFrom || f.joinedTo ? 1 : 0) +
    ((f.devices ?? 'any') !== 'any' ? 1 : 0) +
    (f.activeWithinDays !== undefined ? 1 : 0) +
    (f.inactiveForDays !== undefined ? 1 : 0)
  );
}

const num = (v: string): number | undefined => (v === '' || Number.isNaN(Number(v)) ? undefined : Math.max(0, Math.floor(Number(v))));

function RangeField({ label, value, onChange }: { label: string; value?: Range; onChange: (r: Range | undefined) => void }) {
  const set = (k: 'min' | 'max', v: string) => {
    const next = { ...value, [k]: num(v) };
    onChange(next.min === undefined && next.max === undefined ? undefined : next);
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} placeholder="min" value={value?.min ?? ''} onChange={(e) => set('min', e.target.value)} />
        <span className="text-stone-400">–</span>
        <Input type="number" min={0} placeholder="max" value={value?.max ?? ''} onChange={(e) => set('max', e.target.value)} />
      </div>
    </Field>
  );
}

function Filters({ filter: f, onChange, cities }: { filter: AudienceFilter; onChange: (f: AudienceFilter) => void; cities: string[] }) {
  const set = <K extends keyof AudienceFilter>(k: K, v: AudienceFilter[K]) => onChange({ ...f, [k]: v });
  const status = f.statuses?.length === 4 || !f.statuses?.length ? 'all' : f.statuses.length === 1 ? f.statuses[0]! : 'all';
  return (
    <div className="grid gap-4 border-b border-stone-150 bg-stone-25/60 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Status">
        <Select value={status} onChange={(e) => set('statuses', e.target.value === 'all' ? [] : [e.target.value as 'ACTIVE'])}>
          <option value="ACTIVE">Active (only these are sent to)</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
          <option value="all">All statuses</option>
        </Select>
      </Field>
      <Field label="Category">
        <Select
          value={f.categories?.length === 1 ? f.categories[0] : ''}
          onChange={(e) => set('categories', e.target.value ? [e.target.value as 'ACHARIYA'] : undefined)}
        >
          <option value="">Achariya and Non-Achariya</option>
          <option value="ACHARIYA">Achariya</option>
          <option value="NON_ACHARIYA">Non-Achariya</option>
        </Select>
      </Field>
      <Field label="Device">
        <Select value={f.devices ?? 'any'} onChange={(e) => set('devices', e.target.value as AudienceFilter['devices'])}>
          <option value="any">Any (with or without push)</option>
          <option value="with">Has push on (any phone)</option>
          <option value="android">Has Android</option>
          <option value="ios">Has iPhone</option>
          <option value="none">No device (in-app list only)</option>
        </Select>
      </Field>
      <Field label="City">
        <Select value={f.cities?.[0] ?? ''} onChange={(e) => set('cities', e.target.value ? [e.target.value] : undefined)}>
          <option value="">Any city</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Registered from">
        <Input type="date" value={f.joinedFrom ?? ''} onChange={(e) => set('joinedFrom', e.target.value || undefined)} />
      </Field>
      <Field label="Registered to">
        <Input type="date" value={f.joinedTo ?? ''} onChange={(e) => set('joinedTo', e.target.value || undefined)} />
      </Field>
      <Field label="Bill in the last … days">
        <Input type="number" min={1} placeholder="e.g. 30" value={f.activeWithinDays ?? ''} onChange={(e) => set('activeWithinDays', num(e.target.value) || undefined)} />
      </Field>
      <Field label="No bill for … days">
        <Input type="number" min={1} placeholder="e.g. 30" value={f.inactiveForDays ?? ''} onChange={(e) => set('inactiveForDays', num(e.target.value) || undefined)} />
      </Field>
      <RangeField label="Registered referrals" value={f.registeredReferrals} onChange={(r) => set('registeredReferrals', r)} />
      <RangeField label="Referral QR bills" value={f.referralBills} onChange={(r) => set('referralBills', r)} />
      <RangeField label="Personal discount bills" value={f.personalBills} onChange={(r) => set('personalBills', r)} />
      <RangeField label="Wallet redeem bills" value={f.redeemBills} onChange={(r) => set('redeemBills', r)} />
      <div className="sm:col-span-2 xl:col-span-4">
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_FILTER, search: f.search })}>
          <X className="h-3.5 w-3.5" /> Reset filters
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function ScheduleEditor({
  schedule: s,
  onChange,
  sendAtLocal,
  onSendAt,
}: {
  schedule: ScheduleSpec;
  onChange: (s: ScheduleSpec) => void;
  sendAtLocal: string;
  onSendAt: (v: string) => void;
}) {
  const set = <K extends keyof ScheduleSpec>(k: K, v: ScheduleSpec[K]) => onChange({ ...s, [k]: v });
  return (
    <div className="space-y-4">
      <Segmented<PushScheduleType>
        label="Repeat"
        value={s.type}
        onChange={(t) => set('type', t)}
        options={[
          { value: 'ONCE', label: 'Once' },
          { value: 'DAILY', label: 'Daily' },
          { value: 'WEEKLY', label: 'Weekly' },
        ]}
      />
      {s.type === 'ONCE' && (
        <Field label="Date and time (IST)">
          <Input type="datetime-local" value={sendAtLocal} onChange={(e) => onSendAt(e.target.value)} />
        </Field>
      )}
      {(s.type === 'DAILY' || s.type === 'WEEKLY') && (
        <>
          {s.type === 'WEEKLY' && (
            <Field label="On">
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d, i) => {
                  const on = s.weekdays?.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('weekdays', on ? (s.weekdays ?? []).filter((x) => x !== i) : [...(s.weekdays ?? []), i])}
                      className={cn(
                        'h-8 w-11 rounded-md border text-xs font-medium transition-colors',
                        on ? 'border-maroon-700 bg-maroon-700 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          <Field label="Time (IST)">
            <Input type="time" value={s.timeOfDay ?? ''} onChange={(e) => set('timeOfDay', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Starting">
              <Input type="date" value={s.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
            </Field>
            <Field label="Ending (optional)">
              <Input type="date" value={s.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}
