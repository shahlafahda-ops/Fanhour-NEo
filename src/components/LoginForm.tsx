'use client';

import * as React from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

/** Shared email/password sign-in for the ops and merchant portals. */
export function LoginForm({ title, portal }: { title: string; portal: 'ops' | 'merchant' }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('تعذّر تسجيل الدخول. تحقق من البيانات.');
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <main className="flex-1 flex items-center px-4">
        <form
          onSubmit={signIn}
          className="w-full rounded-card bg-surface-card border border-surface-border p-6 space-y-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/fanhour-mark.png"
            alt="FanHour"
            width={48}
            height={48}
            className="h-12 w-auto mx-auto"
          />
          <h1 className="text-xl font-bold text-center">{title}</h1>
          <p className="text-center text-xs text-content-muted">
            {portal === 'ops' ? 'FanHour Operations' : 'FanHour Merchant'}
          </p>
          <input
            type="email"
            dir="ltr"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-left"
          />
          <input
            type="password"
            dir="ltr"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-left"
          />
          {error && (
            <p className="text-state-danger text-sm text-center" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-card bg-brand-green text-surface-base font-bold py-3 disabled:opacity-50"
          >
            دخول
          </button>
        </form>
      </main>
    </div>
  );
}
