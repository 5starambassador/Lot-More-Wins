'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OutletForm, emptyOutletForm, type OutletFormValues } from '@/components/admin/outlet-form';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated } from '@/lib/admin-client';

export default function NewOutletPage() {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (values: OutletFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await adminApi.createAdminOutlet({
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        logoUrl: values.logoUrl,
        images: values.images,
        adminEmail: values.adminEmail,
        adminPassword: values.adminPassword,
      });
      toast('success', `${res.data.name} created`, 'The outlet is active and can sign in to the Outlet Admin app.');
      router.replace(`/outlets/${res.data.id}`);
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else setError(errorMessage(err, 'Could not create outlet.'));
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Outlets', href: '/outlets' }, { label: 'New outlet' }]}
        title="New outlet"
        description="Add a participating store and create the login its staff will use in the Outlet Admin app."
      />
      <div className="animate-rise-in">
        <OutletForm mode="create" initial={emptyOutletForm()} submitting={submitting} error={error} onSubmit={onSubmit} />
      </div>
    </>
  );
}
