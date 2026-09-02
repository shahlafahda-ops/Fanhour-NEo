'use client';

import * as React from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { AR } from '@/lib/i18n/ar';

interface LookupResult {
  outcome: string;
  statusAr: string;
  campaignId: string | null;
  claimId?: string | null;
}

const VALID_PREVIEW = 'redeemed';

/**
 * Extremely simple merchant experience (prompt §29): manual code entry (+ token
 * from a scanned QR), a validity lookup, then an explicit confirm before the
 * single-use redemption. Merchant sees status only — never supporter PII.
 */
export function MerchantValidator({ displayName }: { displayName: string | null }) {
  const [codeOrToken, setCodeOrToken] = React.useState('');
  const [lookup, setLookup] = React.useState<LookupResult | null>(null);
  const [confirmedResult, setConfirmedResult] = React.useState<LookupResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function payload(confirm: boolean) {
    const v = codeOrToken.trim();
    // A scanned QR yields a long opaque token; a typed fallback looks like FH-XXXX-XXXX.
    const isFallback = /^FH-/i.test(v) || v.length <= 14;
    return isFallback ? { fallbackCode: v, confirm } : { token: v, confirm };
  }

  async function run(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/merchant/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload(confirm)),
      });
      const json = await res.json();
      if (res.status === 401) {
        setError('انتهت الجلسة. سجّل الدخول من جديد.');
        return;
      }
      if (res.status === 403) {
        setError('هذا الرمز لا يخص حملاتك.');
        return;
      }
      if (!res.ok && !json.outcome) {
        setError('خطأ تقني. حاول مرة أخرى.');
        return;
      }
      if (confirm) setConfirmedResult(json);
      else setLookup(json);
    } catch {
      setError('خطأ تقني. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCodeOrToken('');
    setLookup(null);
    setConfirmedResult(null);
    setError(null);
  }

  async function signOut() {
    await getBrowserClient().auth.signOut();
    window.location.reload();
  }

  return (
    <div className="app-shell">
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="font-bold">FanHour Merchant</span>
        <button onClick={signOut} className="text-content-muted text-sm">
          خروج
        </button>
      </header>
      <main className="flex-1 px-4 py-6 space-y-4">
        {displayName && <p className="text-sm text-content-secondary">{displayName}</p>}

        {!confirmedResult && (
          <div className="rounded-card bg-surface-card border border-surface-border p-4 space-y-3">
            <label htmlFor="code" className="text-sm block">
              رمز الاستلام
            </label>
            <input
              id="code"
              dir="ltr"
              placeholder="FH-XXXX-XXXX"
              value={codeOrToken}
              onChange={(e) => setCodeOrToken(e.target.value)}
              className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-center font-mono"
            />
            <button
              onClick={() => run(false)}
              disabled={busy || codeOrToken.trim().length < 4}
              className="w-full rounded-card bg-surface-card2 border border-surface-border py-3 font-semibold disabled:opacity-50"
            >
              تحقق
            </button>
          </div>
        )}

        {error && (
          <p className="text-state-danger text-center text-sm" role="alert">
            {error}
          </p>
        )}

        {lookup && !confirmedResult && (
          <div className="rounded-card bg-surface-card border border-surface-border p-4 space-y-3 text-center">
            <StatusBadge outcome={lookup.outcome} statusAr={lookup.statusAr} />
            {lookup.outcome === VALID_PREVIEW ? (
              <button
                onClick={() => run(true)}
                disabled={busy}
                className="w-full rounded-card bg-brand-green text-surface-base font-bold py-3 disabled:opacity-50"
              >
                تأكيد الاستلام
              </button>
            ) : (
              <button onClick={reset} className="w-full rounded-card border border-surface-border py-3">
                رمز جديد
              </button>
            )}
          </div>
        )}

        {confirmedResult && (
          <div className="rounded-card bg-surface-card border border-surface-border p-6 space-y-4 text-center">
            <StatusBadge outcome={confirmedResult.outcome} statusAr={confirmedResult.statusAr} big />
            {confirmedResult.outcome === VALID_PREVIEW && confirmedResult.claimId && (
              <FirstVisitTap claimId={confirmedResult.claimId} />
            )}
            <button
              onClick={reset}
              className="w-full rounded-card bg-brand-green text-surface-base font-bold py-3"
            >
              رمز جديد
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/** A4 — one optional, skippable, no-PII tap. Never blocks the merchant flow. */
function FirstVisitTap({ claimId }: { claimId: string }) {
  const [answered, setAnswered] = React.useState(false);

  async function answer(firstVisit: 'yes' | 'no' | 'unsure') {
    setAnswered(true); // optimistic — this is diagnostic data, never worth blocking on
    try {
      await fetch('/api/merchant/first-visit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimId, firstVisit }),
      });
    } catch {
      // best-effort; nothing for the merchant to retry
    }
  }

  if (answered) {
    return <p className="text-content-muted text-sm">{AR.merchantFirstVisit.thanks}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-content-secondary text-sm">{AR.merchantFirstVisit.question}</p>
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => answer('yes')}
          className="rounded-card border border-surface-border px-4 py-2 text-sm"
        >
          {AR.merchantFirstVisit.yes}
        </button>
        <button
          onClick={() => answer('no')}
          className="rounded-card border border-surface-border px-4 py-2 text-sm"
        >
          {AR.merchantFirstVisit.no}
        </button>
        <button
          onClick={() => answer('unsure')}
          className="rounded-card border border-surface-border px-4 py-2 text-sm"
        >
          {AR.merchantFirstVisit.unsure}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({
  outcome,
  statusAr,
  big,
}: {
  outcome: string;
  statusAr: string;
  big?: boolean;
}) {
  const ok = outcome === 'redeemed';
  return (
    <div
      className={`rounded-card px-4 py-3 font-bold ${big ? 'text-2xl py-6' : 'text-lg'} ${
        ok ? 'bg-state-success/15 text-state-success' : 'bg-state-danger/15 text-state-danger'
      }`}
    >
      <span aria-hidden className=" me-2">
        {ok ? '✓' : '✕'}
      </span>
      {statusAr}
    </div>
  );
}
