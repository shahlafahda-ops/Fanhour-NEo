'use client';

import * as React from 'react';
import { AR } from '@/lib/i18n/ar';
import { Card, PrimaryButton } from '@/components/ui';

type Step = 'offer' | 'phone' | 'otp' | 'done' | 'dismissed';

/**
 * The ONE new fan-facing surface Part A adds: offered right after a fan's
 * first-ever prediction (the moment of maximum intent). Reuses the existing
 * OTP request/verify routes — a reminder needs a real phone number, there is
 * no channel to an anonymous cookie.
 */
export function ReminderOptIn() {
  const [step, setStep] = React.useState<Step>('offer');
  const [phone, setPhone] = React.useState('');
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function requestOtp() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'invalid_phone' ? AR.otp.invalidPhone : AR.otp.tooMany);
        return;
      }
      setChallengeId(json.challengeId);
      setStep('otp');
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndSubscribe() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, challengeId, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'expired' ? AR.otp.expired : AR.otp.invalidCode);
        return;
      }
      const sub = await fetch('/api/reminders/subscribe', { method: 'POST' });
      if (!sub.ok) {
        setError(AR.reminder.error);
        return;
      }
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'dismissed') return null;

  if (step === 'done') {
    return (
      <Card className="text-center space-y-1">
        <p className="font-semibold">{AR.reminder.subscribedTitle}</p>
        <p className="text-sm text-content-secondary">{AR.reminder.subscribedBody}</p>
      </Card>
    );
  }

  if (step === 'offer') {
    return (
      <Card className="space-y-3 text-center">
        <p className="font-semibold">{AR.reminder.offerTitle}</p>
        <p className="text-sm text-content-secondary">{AR.reminder.offerBody}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setStep('dismissed')}
            className="flex-1 rounded-card border border-surface-border py-2.5 text-sm"
          >
            {AR.reminder.notNow}
          </button>
          <button
            onClick={() => setStep('phone')}
            className="flex-1 rounded-card bg-brand-green text-surface-base font-semibold py-2.5 text-sm"
          >
            {AR.reminder.enable}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      {step === 'phone' && (
        <>
          <p className="text-xs text-content-muted">{AR.reminder.whyPhone}</p>
          <div>
            <label htmlFor="reminder-phone" className="text-sm block mb-1">
              {AR.otp.phoneLabel}
            </label>
            <input
              id="reminder-phone"
              inputMode="tel"
              dir="ltr"
              placeholder={AR.otp.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-left"
            />
          </div>
          {error && <p className="text-state-danger text-sm" role="alert">{error}</p>}
          <PrimaryButton onClick={requestOtp} disabled={busy || !phone}>
            {AR.otp.sendCode}
          </PrimaryButton>
        </>
      )}
      {step === 'otp' && (
        <>
          <label htmlFor="reminder-otp" className="text-sm block">
            {AR.otp.codeLabel}
          </label>
          <input
            id="reminder-otp"
            inputMode="numeric"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-state-danger text-sm" role="alert">{error}</p>}
          <PrimaryButton onClick={verifyAndSubscribe} disabled={busy || code.length !== 6}>
            {AR.otp.verify}
          </PrimaryButton>
          <button onClick={requestOtp} className="text-brand-green text-sm w-full">
            {AR.otp.resend}
          </button>
        </>
      )}
    </Card>
  );
}
