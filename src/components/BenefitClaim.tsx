'use client';

import * as React from 'react';
import QRCode from 'qrcode';
import { AR } from '@/lib/i18n/ar';
import { Card, PrimaryButton } from '@/components/ui';

export interface BenefitClaimData {
  campaignSlug: string;
  sponsorNameAr: string;
  titleAr: string;
  benefitAr: string | null;
  descriptionAr: string | null;
  termsAr: string | null;
  validityLabel: string | null;
  alreadyVerified: boolean;
  appUrl: string;
}

type Step = 'reveal' | 'consent' | 'otp' | 'issued' | 'ineligible';

export function BenefitClaim({ data }: { data: BenefitClaimData }) {
  const [step, setStep] = React.useState<Step>('reveal');
  const [consentBenefit, setConsentBenefit] = React.useState(false);
  const [consentMarketing, setConsentMarketing] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [issued, setIssued] = React.useState<{ token: string; fallbackCode: string } | null>(null);
  const [ineligibleReason, setIneligibleReason] = React.useState<string | null>(null);

  async function startClaim() {
    setError(null);
    if (data.alreadyVerified) {
      await issue();
    } else {
      setStep('consent');
    }
  }

  async function requestOtp() {
    setError(null);
    if (!consentBenefit) {
      setError(AR.benefit.consentBenefit);
      return;
    }
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

  async function verifyOtp() {
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
      await issue();
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/benefit/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignSlug: data.campaignSlug,
          consentBenefit: true,
          consentMarketing,
        }),
      });
      const json = await res.json();
      if (res.status === 403 && json.error === 'not_eligible') {
        setIneligibleReason(json.reason);
        setStep('ineligible');
        return;
      }
      if (!res.ok) {
        setError(AR.benefit.unavailable);
        return;
      }
      setIssued({ token: json.token, fallbackCode: json.fallbackCode });
      setStep('issued');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-2 text-center">
        <div className="text-xs text-content-muted">{AR.benefit.fromPartner}</div>
        <div className="text-lg font-bold">{data.sponsorNameAr}</div>
        <div className="text-content-primary">{data.benefitAr ?? data.titleAr}</div>
        {data.descriptionAr && (
          <p className="text-sm text-content-secondary">{data.descriptionAr}</p>
        )}
        {data.validityLabel && (
          <p className="text-xs text-content-muted">
            {AR.benefit.validity} {data.validityLabel}
          </p>
        )}
      </Card>

      {step === 'reveal' && (
        <>
          {data.termsAr && (
            <Card>
              <h3 className="text-sm font-semibold mb-1">{AR.benefit.terms}</h3>
              <p className="text-xs text-content-secondary whitespace-pre-line">{data.termsAr}</p>
            </Card>
          )}
          <PrimaryButton onClick={startClaim} disabled={busy}>
            {AR.benefit.claim}
          </PrimaryButton>
        </>
      )}

      {step === 'consent' && (
        <Card className="space-y-4">
          <p className="text-xs text-content-muted">{AR.otp.whyPhone}</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentBenefit}
              onChange={(e) => setConsentBenefit(e.target.checked)}
              className="mt-1"
            />
            <span>{AR.benefit.consentBenefit}</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.checked)}
              className="mt-1"
            />
            <span>{AR.benefit.consentMarketing}</span>
          </label>
          <div>
            <label htmlFor="phone" className="text-sm block mb-1">
              {AR.otp.phoneLabel}
            </label>
            <input
              id="phone"
              inputMode="tel"
              dir="ltr"
              placeholder={AR.otp.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-left"
            />
          </div>
          {error && <p className="text-state-danger text-sm" role="alert">{error}</p>}
          <PrimaryButton onClick={requestOtp} disabled={busy || !consentBenefit}>
            {AR.otp.sendCode}
          </PrimaryButton>
        </Card>
      )}

      {step === 'otp' && (
        <Card className="space-y-4">
          <label htmlFor="otp" className="text-sm block">
            {AR.otp.codeLabel}
          </label>
          <input
            id="otp"
            inputMode="numeric"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-lg bg-surface-card2 border border-surface-border py-3 px-3 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-state-danger text-sm" role="alert">{error}</p>}
          <PrimaryButton onClick={verifyOtp} disabled={busy || code.length !== 6}>
            {AR.otp.verify}
          </PrimaryButton>
          <button onClick={requestOtp} className="text-brand-green text-sm w-full">
            {AR.otp.resend}
          </button>
        </Card>
      )}

      {step === 'ineligible' && (
        <Card className="text-center space-y-2">
          <p className="text-content-secondary">
            {ineligibleReason === 'no_qualifying_participation'
              ? AR.benefit.notEligible
              : AR.benefit.unavailable}
          </p>
        </Card>
      )}

      {step === 'issued' && issued && (
        <IssuedCredential issued={issued} appUrl={data.appUrl} campaignSlug={data.campaignSlug} />
      )}
    </div>
  );
}

function IssuedCredential({
  issued,
  appUrl,
  campaignSlug,
}: {
  issued: { token: string; fallbackCode: string };
  appUrl: string;
  campaignSlug: string;
}) {
  const [qr, setQr] = React.useState<string | null>(null);
  const claimUrl = `${appUrl}/app/alhazem/benefit/${campaignSlug}/verify#${issued.token}`;

  React.useEffect(() => {
    QRCode.toDataURL(claimUrl, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [claimUrl]);

  return (
    <Card className="space-y-3 text-center">
      <h3 className="font-semibold">{AR.benefit.yourCode}</h3>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="QR"
          className="mx-auto rounded-lg bg-white p-2"
          width={200}
          height={200}
        />
      ) : (
        <div className="h-[200px] flex items-center justify-center text-content-muted">
          {AR.common.loading}
        </div>
      )}
      <div className="text-2xl font-mono tracking-widest" dir="ltr">
        {issued.fallbackCode}
      </div>
      <p className="text-xs text-content-muted">{AR.benefit.showToMerchant}</p>
    </Card>
  );
}
