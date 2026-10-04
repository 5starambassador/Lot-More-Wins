'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ApiClientError } from '@lotmorewins/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage } from '@/lib/admin-client';
import { formatNumber } from '@/lib/format';
import { useAdminAccess } from './admin-access';

/**
 * "Reset" on the dashboard: removes every partner, guest customer, transaction and QR code,
 * after the reset PIN is entered. Shown to the Super Admin only; the API checks the role and
 * the PIN again.
 */
export function ResetDataButton({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { isSuperAdmin } = useAdminAccess();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSuperAdmin) return null;

  const start = () => {
    setPin('');
    setError(null);
    setOpen(true);
  };

  const confirm = async () => {
    if (!pin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await adminApi.resetProgrammeData(pin);
      setOpen(false);
      toast(
        'success',
        'Data reset',
        `Removed ${formatNumber(data.partners)} partners, ${formatNumber(data.customers)} guest customers, ${formatNumber(data.bills)} transactions and ${formatNumber(data.qrCodes)} QR codes.`
      );
      onDone();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'INVALID_PIN') setError('That PIN is not correct. Nothing was removed.');
      else toast('error', 'Could not reset', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="danger-outline" onClick={start}>
        <RotateCcw className="h-4 w-4" /> Reset
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        onConfirm={confirm}
        busy={busy}
        tone="danger"
        title="Reset partners and transactions?"
        confirmLabel="Reset data"
        confirmDisabled={!pin}
        description="This permanently removes every registered partner, every guest customer, every transaction and every QR code, along with wallets and points. It cannot be undone."
      >
        <p className="mb-3 text-[13px] text-stone-700">Outlets, outlet admins, admin accounts and settings are not touched.</p>
        <label className="block text-xs text-stone-600" htmlFor="reset-pin">
          Enter the reset PIN to continue
        </label>
        <Input
          id="reset-pin"
          type="password"
          className="mt-1.5"
          autoComplete="off"
          autoFocus
          value={pin}
          aria-invalid={!!error}
          onChange={(e) => {
            setPin(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
        />
        {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
      </ConfirmDialog>
    </>
  );
}
