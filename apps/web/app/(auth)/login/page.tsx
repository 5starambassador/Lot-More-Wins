'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Alert } from '@/components/ui/feedback';
import { adminApi, errorMessage } from '@/lib/admin-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminApi.adminLogin({ email, password });
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate={false}>
      <div className="lg:hidden">
        <Image src="/brand/lotmore-logo.png" alt="Lot More" width={64} height={64} priority className="h-16 w-16 rounded-md border border-gold-400/60 bg-white object-contain" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">Super Admin</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-stone-900">Sign in to the console</h1>
        <p className="mt-1.5 text-[13px] text-stone-500">Use the administrator credentials issued for Lot More Wins.</p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="space-y-4">
        <Field label="Email address" htmlFor="email">
          <Input
            id="email"
            type="email"
            icon={Mail}
            autoComplete="username"
            autoFocus
            required
            placeholder="admin@example.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-400 transition-colors hover:text-stone-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-xs text-stone-400">
        Lost access? Ask the platform owner to reset the Super Admin credentials.
      </p>
    </form>
  );
}
