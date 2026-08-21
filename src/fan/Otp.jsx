import { useState, useEffect } from 'react';
import { Button, Notice } from '../lib/ui.jsx';
import { fanApi, ApiError } from '../lib/api.js';

/*
 * OTP verification.
 *
 * Successful OTP is mandatory before any claim token is issued, and it is the
 * last step before issuance — never later. If it fails, the fan's result stays
 * intact and they can retry without replaying the challenge, which the screen
 * states explicitly so a failure does not read as losing the result.
 */
export default function Otp({ verification, offerId, onIssued, onBack }) {
  const [code, setCode] = useState('');
  const [marketing, setMarketing] = useState(false);   // separate, optional, unchecked
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(60);
  const [demoOtp, setDemoOtp] = useState(verification.demoOtp || null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e) {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fanApi.verifyConfirm({
        verificationId: verification.verificationId,
        code,
        mobile: verification.mobile,
        marketingConsent: marketing,
      });
      onIssued(res.claim, { alreadyClaimed: res.alreadyClaimed });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'تعذّر التحقق من الرمز.';
      const left = err?.body?.attemptsLeft;
      setError(left != null ? `${msg} المحاولات المتبقية: ${left}` : msg);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fanApi.verifyStart({
        birthYear: verification.birthYear,
        locality: verification.locality,
        mobile: verification.mobile,
        acceptTerms: true,
        offerId,
        resend: true,
      });
      if (res.demoOtp) setDemoOtp(res.demoOtp);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إعادة الإرسال.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="screen stack" onSubmit={submit} noValidate>
      <div className="stack-s">
        <span className="eyebrow">التحقق</span>
        <h1>أدخل رمز التحقق</h1>
        <p className="lede">
          أرسلنا رمزًا من ٦ أرقام إلى الجوال المنتهي بـ{' '}
          <span className="num">{verification.mobileLast2}</span>.
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="otp">رمز التحقق</label>
        <input
          id="otp"
          className="input input--code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!!error}
          autoFocus
        />
      </div>

      {demoOtp && (
        <div className="demo-otp">
          <span className="demo-otp__tag">وضع العرض التوضيحي</span>
          <span className="demo-otp__code num">{demoOtp}</span>
          <span className="demo-otp__note">
            يظهر الرمز هنا لأغراض العرض فقط. في التشغيل الفعلي يصل عبر رسالة نصية.
          </span>
        </div>
      )}

      {error && <Notice tone="err">{error}</Notice>}

      {/* Optional, separate from the claim acceptance, and never required. */}
      <label className="check">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>
          أرغب بتذكير من فان أور بموعد تحدي الجولة القادمة. (اختياري — لا علاقة له بالحصول على المزية.)
        </span>
      </label>

      <Button type="submit" disabled={code.length !== 6 || busy}>
        {busy ? 'جارٍ التحقق…' : 'تحقق واستلم المزية'}
      </Button>

      <button type="button" className="btn btn--ghost" onClick={resend} disabled={cooldown > 0 || busy}>
        {cooldown > 0
          ? <>إعادة إرسال الرمز بعد <span className="num">{cooldown}</span> ثانية</>
          : 'إعادة إرسال الرمز'}
      </button>

      <Notice tone="info">
        نتيجتك محفوظة. إذا لم يصلك الرمز، يمكنك المحاولة لاحقًا دون إعادة التحدي.
      </Notice>

      <button type="button" className="btn btn--ghost" onClick={onBack}>تعديل البيانات</button>
    </form>
  );
}
