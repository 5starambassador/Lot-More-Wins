'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog, Wand2 } from 'lucide-react';
import type { AdminAccount, AdminPage, CreateAdminAccountPayload, UpdateAdminAccountPayload } from '@lotmorewins/types';
import { ADMIN_PAGE_LABELS, ADMIN_PAGES } from '@lotmorewins/validation';
import { useAdminAccess } from '@/components/admin/admin-access';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Drawer } from '@/components/ui/dialog';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated, useAdminQuery } from '@/lib/admin-client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FormState {
  name: string;
  email: string;
  mobile: string;
  position: string;
  pages: AdminPage[];
  canDelete: boolean;
  isActive: boolean;
  /** Required for a new admin; on an existing one, only filled in to set a new password. */
  password: string;
}

const EMPTY_FORM: FormState = { name: '', email: '', mobile: '', position: '', pages: [], canDelete: false, isActive: true, password: '' };

const toForm = (a: AdminAccount): FormState => ({
  name: a.name,
  email: a.email,
  mobile: a.mobile ?? '',
  position: a.position ?? '',
  pages: a.pages,
  canDelete: a.canDelete,
  isActive: a.isActive,
  password: '',
});

/** 14 characters with letters and digits, for the admin to pass on. */
function generatePassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  const chars = Array.from(bytes, (b) => all[b % all.length]);
  chars[0] = letters[bytes[0]! % letters.length]!;
  chars[1] = digits[bytes[1]! % digits.length]!;
  return chars.join('');
}

function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
        checked ? 'border-maroon-700/40 bg-maroon-50/40' : 'border-stone-200 bg-white hover:border-stone-300'
      )}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          checked ? 'border-maroon-700 bg-maroon-700 text-white' : 'border-stone-300 bg-white'
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-stone-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

function AdminForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: AdminAccount | null;
  onClose: () => void;
  onSaved: (admin: AdminAccount, created: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(editing ? toForm(editing) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const togglePage = (page: AdminPage, on: boolean) =>
    set('pages')(on ? ADMIN_PAGES.filter((p) => p === page || form.pages.includes(p)) : form.pages.filter((p) => p !== page));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const fields = {
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        position: form.position,
        pages: form.pages,
        canDelete: form.canDelete,
        isActive: form.isActive,
      };
      const res = editing
        ? await adminApi.updateAdminAccount(editing.id, { ...fields, ...(form.password && { password: form.password }) } satisfies UpdateAdminAccountPayload)
        : await adminApi.createAdminAccount({ ...fields, password: form.password } satisfies CreateAdminAccountPayload);
      onSaved(res.data, !editing);
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else setError(errorMessage(err, 'Could not save this admin.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={() => !saving && onClose()}
      title={editing ? `Edit ${editing.name}` : 'Add admin'}
      subtitle="Admins sign in on the same login page with this email and password, and only see the pages ticked below."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="admin-form" loading={saving}>
            {editing ? 'Save changes' : 'Add admin'}
          </Button>
        </div>
      }
    >
      <form
        id="admin-form"
        className="space-y-5 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="admin-name" required>
            <Input id="admin-name" required minLength={2} value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </Field>
          <Field label="Position" htmlFor="admin-position" required>
            <Input
              id="admin-position"
              required
              minLength={2}
              placeholder="e.g. Accounts manager"
              value={form.position}
              onChange={(e) => set('position')(e.target.value)}
            />
          </Field>
          <Field label="Email (login)" htmlFor="admin-email" required>
            <Input id="admin-email" type="email" required autoComplete="off" value={form.email} onChange={(e) => set('email')(e.target.value)} />
          </Field>
          <Field label="Mobile" htmlFor="admin-mobile" required>
            <Input
              id="admin-mobile"
              type="tel"
              inputMode="numeric"
              required
              prefix="+91"
              value={form.mobile}
              onChange={(e) => set('mobile')(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label={editing ? 'New password' : 'Password'}
          htmlFor="admin-password"
          required={!editing}
          hint={
            editing
              ? 'Leave empty to keep the current password. At least 10 characters, letters and numbers.'
              : 'At least 10 characters, letters and numbers. Share it with the admin securely.'
          }
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="admin-password"
                type="text"
                autoComplete="new-password"
                required={!editing}
                minLength={10}
                icon={KeyRound}
                className="font-mono"
                value={form.password}
                onChange={(e) => set('password')(e.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => set('password')(generatePassword())}>
              <Wand2 className="h-4 w-4" /> Generate
            </Button>
          </div>
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium text-stone-800">Page access</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ADMIN_PAGES.map((page) => (
              <Checkbox key={page} label={ADMIN_PAGE_LABELS[page]} checked={form.pages.includes(page)} onChange={(on) => togglePage(page, on)} />
            ))}
          </div>
          <p className="text-xs text-stone-500">Pages left unticked are hidden and blocked for this admin, including their data. Only the Super Admin manages admins.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium text-stone-800">Permissions</legend>
          <Checkbox
            label="Can delete records"
            hint="Permanently delete partners, outlets and transactions on the pages above."
            checked={form.canDelete}
            onChange={set('canDelete')}
          />
          <Checkbox
            label="Account active"
            hint="Untick to stop this admin signing in, without deleting the account."
            checked={form.isActive}
            onChange={set('isActive')}
          />
        </fieldset>
      </form>
    </Drawer>
  );
}

export default function AdminsPage() {
  const toast = useToast();
  const { admin: me } = useAdminAccess();
  const { data: admins, error, loading, reload, setData } = useAdminQuery(() => adminApi.listAdminAccounts().then((r) => r.data), []);
  const [editing, setEditing] = useState<AdminAccount | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminAccount | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminApi.deleteAdminAccount(deleting.id);
      setData((list) => list?.filter((a) => a.id !== deleting.id) ?? list);
      toast('success', 'Admin deleted', `${deleting.name} can no longer sign in.`);
      setDeleting(null);
    } catch (err) {
      toast('error', 'Could not delete admin', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Admins"
        description="People who can sign in to this panel. Each admin only sees the pages you give them; the Super Admin has every page."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Add admin
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Panel>
        <TableScroll>
          <Table>
            <THead>
              <tr>
                <TH>Admin</TH>
                <TH>Contact</TH>
                <TH>Page access</TH>
                <TH>Delete</TH>
                <TH>Status</TH>
                <TH>Added</TH>
                <TH align="right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {loading && !admins ? (
                <SkeletonRows cols={7} />
              ) : admins && admins.length > 0 ? (
                admins.map((a) => {
                  const isSuper = a.role === 'SUPER_ADMIN';
                  return (
                    <TR key={a.id}>
                      <TD>
                        <p className="font-medium text-stone-900">
                          {a.name}
                          {a.id === me.id && <span className="ml-1.5 text-xs font-normal text-stone-400">(you)</span>}
                        </p>
                        <p className="text-xs text-stone-500">{isSuper ? 'Super Admin' : a.position || 'Admin'}</p>
                      </TD>
                      <TD>
                        <p className="text-[13px]">{a.email}</p>
                        {a.mobile && <p className="tabular text-xs text-stone-500">+91 {a.mobile}</p>}
                      </TD>
                      <TD>
                        {isSuper ? (
                          <Tag gold>
                            <ShieldCheck className="mr-1 inline h-3 w-3" /> Every page
                          </Tag>
                        ) : a.pages.length > 0 ? (
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {a.pages.map((p) => (
                              <Tag key={p}>{ADMIN_PAGE_LABELS[p]}</Tag>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">No pages</span>
                        )}
                      </TD>
                      <TD>{a.canDelete ? <Badge tone="warning">Allowed</Badge> : <span className="text-xs text-stone-400">No</span>}</TD>
                      <TD>{a.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</TD>
                      <TD className="whitespace-nowrap text-xs text-stone-500">{formatDate(a.createdAt)}</TD>
                      <TD align="right">
                        {isSuper ? (
                          <span className="text-xs text-stone-400">Protected</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(a)} aria-label={`Delete ${a.name}`} className="text-red-700 hover:bg-red-50 hover:text-red-800">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TD>
                    </TR>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={UserCog}
                      title="No admins yet"
                      description="Add an admin and choose which pages they can use."
                      action={<Button onClick={() => setEditing('new')}>Add admin</Button>}
                    />
                  </td>
                </tr>
              )}
            </TBody>
          </Table>
        </TableScroll>
      </Panel>

      {editing && (
        <AdminForm
          editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setData((list) => (created ? [...(list ?? []), saved] : (list ?? []).map((a) => (a.id === saved.id ? saved : a))));
            toast('success', created ? 'Admin added' : 'Admin updated', created ? `${saved.name} can now sign in with ${saved.email}.` : undefined);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        tone="danger"
        title={`Delete ${deleting?.name ?? 'admin'}?`}
        confirmLabel="Delete admin"
        description="Their account is removed and they can no longer sign in. Records they worked on are not affected. This cannot be undone."
      />
    </>
  );
}
