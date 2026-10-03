'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { DeletionImpact } from '@lotmorewins/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage } from '@/lib/admin-client';
import { formatNumber } from '@/lib/format';
import { useAdminAccess } from './admin-access';

const CONFIRM_WORD = 'DELETE';

const KINDS = {
  partner: {
    page: 'partners' as const,
    label: 'partner',
    back: '/partners',
    impact: (id: string) => adminApi.getPartnerDeletionImpact(id),
    remove: (id: string) => adminApi.deleteAdminPartner(id),
    removes: 'Their account, QR codes, notifications and wallet are removed, along with:',
  },
  outlet: {
    page: 'outlets' as const,
    label: 'outlet',
    back: '/outlets',
    impact: (id: string) => adminApi.getOutletDeletionImpact(id),
    remove: (id: string) => adminApi.deleteAdminOutlet(id),
    removes: 'The outlet disappears from the Partner App and its admin can no longer sign in. Also removed:',
  },
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/**
 * "Delete" for a partner or outlet detail page. Shown only to admins with the page and the delete
 * permission. Loads what else would be removed, then asks for "DELETE" to be typed before it
 * permanently deletes (the API checks the same permission).
 */
export function DeleteRecordButton({ kind, id, name }: { kind: keyof typeof KINDS; id: string; name: string }) {
  const k = KINDS[kind];
  const router = useRouter();
  const toast = useToast();
  const { canDelete } = useAdminAccess();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!canDelete(k.page)) return null;

  const start = async () => {
    setLoading(true);
    try {
      setImpact((await k.impact(id)).data);
      setTyped('');
      setOpen(true);
    } catch (err) {
      toast('error', `Could not prepare the ${k.label} deletion`, errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setDeleting(true);
    try {
      await k.remove(id);
      toast('success', `${name} deleted`);
      setOpen(false);
      router.replace(k.back);
      router.refresh();
    } catch (err) {
      toast('error', `Could not delete this ${k.label}`, errorMessage(err));
      setDeleting(false);
    }
  };

  const items = impact
    ? [
        plural(impact.bills, 'transaction'),
        plural(impact.pointsEntries, 'points entry', 'points entries') + ' in partner wallets',
        plural(impact.redemptions, 'wallet redemption'),
        ...(impact.outletAdmins !== undefined ? [plural(impact.outletAdmins, 'outlet admin login')] : []),
      ]
    : [];

  return (
    <>
      <Button variant="danger-outline" onClick={start} loading={loading}>
        <Trash2 className="h-4 w-4" /> Delete {k.label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        busy={deleting}
        tone="danger"
        title={`Delete ${name}?`}
        confirmLabel={`Delete ${k.label}`}
        confirmDisabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
        description={
          <>
            This permanently deletes the {k.label} and cannot be undone. {k.removes}
          </>
        }
      >
        <ul className="mb-3 list-disc space-y-0.5 pl-4 text-[13px] text-stone-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <label className="block text-xs text-stone-600" htmlFor="confirm-delete">
          Type <span className="font-mono font-semibold text-stone-900">{CONFIRM_WORD}</span> to confirm
        </label>
        <Input id="confirm-delete" className="mt-1.5 font-mono" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </ConfirmDialog>
    </>
  );
}
