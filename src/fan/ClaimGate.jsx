import { useState } from 'react';
import { Button, Notice } from '../lib/ui.jsx';
import { fanApi, ApiError } from '../lib/api.js';

/*
 * Claim gate — eligibility.
 *
 * This is the first and only point in the fan journey that collects personal
 * data, and it happens only after the fan has seen the result and asked to
 * claim. It collects exactly four things: 18+ status (as a birth year), a
 * coarse home area, a Saudi mobile, and an explicit acceptance.
 *
 * Deliberately absent: GPS, postcode, full address, national ID, full name.
 */

const CURRENT_YEAR = new Date().getFullYear();

export default function ClaimGate({ intent, onSent, onBack }) {
  const [birthYear, setBirthYear] = useState('');
  const [locality, setLocality] = useState('');
  const [mobile, setMobile] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const yearValid = /^\d{4}$/.test(birthYear) &&
    Number(birthYear) <= CURRENT_YEAR && Number(birthYear) > CURRENT_YEAR - 110;
  const mobileValid = /^(?:\+?966|0)?5\d{8}$/.test(mobile.replace(/[\s-]/g, ''));
  const canSubmit = yearValid && locality && mobileValid && accept && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fanApi.verifyStart({
        birthYear: Number(birthYear),
        locality,
        mobile: mobile.replace(/[\s-]/g, ''),
        acceptTerms: true,
        offerId: intent.offerId,
      });
      // Eligibility travels with the verification so a resend never re-asks the fan.
      onSent({
        ...res,
        mobile: mobile.replace(/[\s-]/g, ''),
        birthYear: Number(birthYear),
        locality,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال رمز التحقق.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="screen stack" onSubmit={submit} noValidate>
      <div className="stack-s">
        <span className="eyebrow">تأكيد الاستحقاق</span>
        <h1>خطوة أخيرة قبل استلام المزية</h1>
        <p className="lede">{intent.required_ar.data}</p>
      </div>

      <Notice tone="info">{intent.required_ar.age}</Notice>

      <div className="field">
        <label className="field__label" htmlFor="birthYear">سنة الميلاد</label>
        <input
          id="birthYear"
          className="input num"
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="1995"
          maxLength={4}
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))}
          aria-invalid={birthYear !== '' && !yearValid}
          aria-describedby="birthYear-hint"
        />
        <span className="field__hint" id="birthYear-hint">
          نطلب السنة فقط — لا نطلب تاريخ ميلادك الكامل.
        </span>
      </div>

      <fieldset className="field" style={{ border: 'none' }}>
        <legend className="field__label" style={{ marginBottom: 7 }}>أين تسكن عادةً؟</legend>
        {intent.localities.map((l) => (
          <label className="radio" key={l.key} style={{ marginBottom: 8 }}>
            <input
              type="radio"
              name="locality"
              value={l.key}
              checked={locality === l.key}
              onChange={() => setLocality(l.key)}
            />
            <span>{l.label_ar}</span>
          </label>
        ))}
        <span className="field__hint">
          نسأل عن المنطقة العامة فقط، ولا نطلب إذن الموقع الجغرافي.
        </span>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor="mobile">رقم الجوال</label>
        <input
          id="mobile"
          className="input num"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="05XXXXXXXX"
          dir="ltr"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          aria-invalid={mobile !== '' && !mobileValid}
          aria-describedby="mobile-hint"
        />
        <span className="field__hint" id="mobile-hint">
          نرسل رمز تحقق لمرة واحدة. الرقم يُستخدم للتحقق ومنع تكرار الاستفادة فقط.
        </span>
      </div>

      <label className="check">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>
          أُقرّ بأن عمري 18 سنة فأكثر، وأوافق على شروط الاستفادة وسياسة الخصوصية.
        </span>
      </label>

      {error && <Notice tone="err">{error}</Notice>}

      <Button type="submit" disabled={!canSubmit}>
        {busy ? 'جارٍ إرسال الرمز…' : 'أرسل رمز التحقق'}
      </Button>

      <button type="button" className="btn btn--ghost" onClick={onBack}>رجوع</button>
    </form>
  );
}
