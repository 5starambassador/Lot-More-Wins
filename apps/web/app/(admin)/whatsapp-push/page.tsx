'use client';

import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { ApiResponse } from '@lotmorewins/types';
import { Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, useAdminQuery } from '@/lib/admin-client';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WhatsAppPushOverview, WhatsAppPushRun, WhatsAppPushTemplateState } from '@/lib/whatsapp-push';

const CONFIRM_WORD = 'SEND';

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export default function WhatsAppPushPage() {
  const { data, error, loading, reload, setData } = useAdminQuery(
    () => adminApi.get<ApiResponse<WhatsAppPushOverview>>('/admin/whatsapp-push').then((r) => r.data!),
    []
  );

  return (
    <>
      <PageHeader
        title="WhatsApp push messages"
        description="Send an MSG91 WhatsApp template to every active partner's mobile number. Turn a template on only after MSG91 has approved it; it can then be sent once."
        meta={data && <Tag className="tabular">{formatNumber(data.recipients)} active partners</Tag>}
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {data && !data.configured && (
        <Alert tone="danger" className="mb-4">
          MSG91 WhatsApp is not configured on this server (MSG91_AUTH_KEY / MSG91_INTEGRATED_NUMBER), so nothing can be sent from here.
        </Alert>
      )}
      {loading && !data && <Skeleton className="h-80 w-full" />}
      {data && data.templates.length === 0 && <EmptyState icon={MessageCircle} title="No templates yet" description="Templates are added once they are submitted in MSG91." />}
      <div className="space-y-6">
        {data?.templates.map((t) => (
          <TemplateCard
            key={t.name}
            template={t}
            recipients={data.recipients}
            configured={data.configured}
            onChange={(overview) => setData(() => overview)}
            onRunUpdate={(run) =>
              setData((d) => d && { ...d, templates: d.templates.map((x) => (x.name === t.name ? { ...x, run } : x)) })
            }
            reload={reload}
          />
        ))}
      </div>
    </>
  );
}

function StatusTag({ template }: { template: WhatsAppPushTemplateState }) {
  const { run, approved } = template;
  if (run?.status === 'sent') return <Tag gold>Sent</Tag>;
  if (run) return <Tag gold>Sending paused</Tag>;
  if (approved) return <Tag gold>On — ready to send</Tag>;
  return <Tag>Off — waiting for MSG91 approval</Tag>;
}

function TemplateCard({
  template: t,
  recipients,
  configured,
  onChange,
  onRunUpdate,
  reload,
}: {
  template: WhatsAppPushTemplateState;
  recipients: number;
  configured: boolean;
  onChange: (overview: WhatsAppPushOverview) => void;
  onRunUpdate: (run: WhatsAppPushRun) => void;
  reload: () => void;
}) {
  const toast = useToast();
  const [switching, setSwitching] = useState(false);
  const [testMobile, setTestMobile] = useState('');
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [sending, setSending] = useState(false);
  const run = t.run;
  const sent = run?.status === 'sent';

  async function toggle() {
    setSwitching(true);
    try {
      const res = await adminApi.put<ApiResponse<WhatsAppPushOverview>>(`/admin/whatsapp-push/${t.name}`, { approved: !t.approved });
      onChange(res.data!);
      toast('success', res.message ?? 'Saved');
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await adminApi.post<ApiResponse<{ recipient: string }>>(`/admin/whatsapp-push/${t.name}/test`, { mobile: testMobile });
      toast('success', 'Test message sent', `To ${res.data!.recipient}. Check WhatsApp on that phone.`);
    } catch (err) {
      toast('error', 'Test not sent', errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  /** Sends batch after batch until the run is done, so no single request runs long. */
  async function sendAll() {
    setConfirmOpen(false);
    setTyped('');
    setSending(true);
    try {
      for (;;) {
        const res = await adminApi.post<ApiResponse<WhatsAppPushRun>>(`/admin/whatsapp-push/${t.name}/send`, undefined, { timeoutMs: 70_000 });
        const next = res.data!;
        onRunUpdate(next);
        if (next.status === 'sent') {
          toast('success', 'WhatsApp push sent', `${formatNumber(next.sent)} sent, ${formatNumber(next.failed)} failed.`);
          break;
        }
      }
    } catch (err) {
      toast('error', 'Sending stopped', `${errorMessage(err)} You can resume; partners already messaged are not sent to again.`);
      reload();
    } finally {
      setSending(false);
    }
  }

  const pct = run && run.total ? Math.min(100, Math.round((run.done / run.total) * 100)) : 0;
  const canSend = configured && t.approved && !sent && !sending && !t.running;

  return (
    <Panel>
      <PanelHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{t.name}</span>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t.title} <StatusTag template={t} />
          </span>
        }
        description={`MSG91 template ${t.msg91TemplateId} · language ${t.language}`}
        actions={
          <button
            type="button"
            role="switch"
            aria-checked={t.approved}
            aria-label="Template approved in MSG91"
            disabled={switching || sending}
            onClick={toggle}
            className="flex items-center gap-2.5 rounded-md border border-stone-150 px-3 py-2 text-[13px] font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            <span className={cn('relative h-5 w-9 rounded-full transition-colors', t.approved ? 'bg-maroon-700' : 'bg-stone-300')}>
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', t.approved ? 'left-[18px]' : 'left-0.5')} />
            </span>
            {t.approved ? 'On' : 'Off'}
          </button>
        }
      />
      <PanelBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Message</p>
          <div className="max-h-[520px] overflow-y-auto rounded-lg bg-[#e7ddd3] p-3">
            <div className="whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-white px-3 py-2.5 text-[13px] leading-relaxed text-stone-900 shadow-sm">
              {t.body}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {!t.approved && !run && (
            <Alert tone="info">
              Waiting for approval. Check the template in MSG91; once it shows as approved, turn the switch on to allow sending.
            </Alert>
          )}
          {t.approved && t.approvedAt && (
            <p className="text-xs text-stone-500">
              Turned on {when(t.approvedAt)}
              {t.approvedBy ? ` by ${t.approvedBy}` : ''}.
            </p>
          )}

          <div>
            <p className="mb-1 text-[13px] font-medium text-stone-900">Send a test</p>
            <p className="mb-2 text-xs text-stone-500">Sends this template to one mobile number only, to check it before sending to everyone.</p>
            <div className="flex gap-2">
              <Input
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value)}
                placeholder="10-digit mobile number"
                inputMode="tel"
                className="max-w-[220px]"
              />
              <Button variant="secondary" onClick={sendTest} loading={testing} disabled={!configured || testMobile.trim().length < 10}>
                Send test
              </Button>
            </div>
          </div>

          <div className="border-t border-stone-150 pt-5">
            <p className="mb-1 text-[13px] font-medium text-stone-900">Send to all partners</p>
            <p className="mb-3 text-xs text-stone-500">
              Sends to {formatNumber(recipients)} active partners on WhatsApp, once. Each partner gets it only one time, even if sending is resumed.
            </p>

            {run && (
              <div className="mb-3 space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-maroon-700 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="tabular text-xs text-stone-600">
                  {formatNumber(run.done)} of {formatNumber(run.total)} handled · {formatNumber(run.sent)} sent · {formatNumber(run.failed)} failed
                  {sent && run.finishedAt ? ` · finished ${when(run.finishedAt)}` : ''}
                </p>
                <p className="text-xs text-stone-500">
                  Started {when(run.startedAt)} by {run.startedBy}.
                </p>
              </div>
            )}

            {!sent && (
              <Button onClick={() => (run ? sendAll() : setConfirmOpen(true))} loading={sending} disabled={!canSend}>
                <Send className="h-4 w-4" />
                {sending ? 'Sending…' : run ? 'Resume sending' : `Send to ${formatNumber(recipients)} partners`}
              </Button>
            )}
            {sending && <p className="mt-2 text-xs text-stone-500">Keep this page open until it finishes.</p>}
            {t.running && !sending && <p className="mt-2 text-xs text-stone-500">A batch is sending from another window. Refresh in a minute.</p>}
            {!t.approved && !sent && <p className="mt-2 text-xs text-stone-500">Turn the switch on to send.</p>}

            {run && run.errors.length > 0 && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-stone-600">
                  Failed numbers ({formatNumber(run.failed)}
                  {run.failed > run.errors.length ? `, first ${run.errors.length} shown` : ''})
                </summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {run.errors.map((e, i) => (
                    <li key={i} className="tabular text-stone-600">
                      {e.mobile}: <span className="text-stone-500">{e.error}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </PanelBody>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setTyped('');
        }}
        onConfirm={sendAll}
        title={`Send to ${formatNumber(recipients)} partners?`}
        description={
          <>
            <MessageCircle className="mr-1 inline h-3.5 w-3.5" />
            “{t.title}” goes to every active partner on WhatsApp now. This cannot be undone. Type {CONFIRM_WORD} to confirm.
          </>
        }
        confirmLabel="Send now"
        confirmDisabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
      >
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD} autoFocus />
      </ConfirmDialog>
    </Panel>
  );
}
