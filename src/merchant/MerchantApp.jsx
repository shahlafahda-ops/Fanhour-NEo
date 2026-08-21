import { useState, useEffect } from 'react';
import { merchantApi, staffToken, ApiError } from '../lib/api.js';
import { Button, Notice } from '../lib/ui.jsx';

/*
 * Merchant validator.
 *
 * Runs on an ordinary staff phone. Deliberately plain: one input, one verdict,
 * one confirm. Nothing on this screen identifies the fan — staff see a code, an
 * offer and a status, which is all they need to hand over the benefit.
 */

const RESULT_TONE = {
  VALID: 'ok',
  EXPIRED: 'warn',
  ALREADY_REDEEMED: 'warn',
  WRONG_OFFER_LOCATION: 'err',
  MANUAL_REVIEW: 'warn',
  NOT_FOUND: 'err',
};

const RESULT_ICON = {
  VALID: '✓',
  EXPIRED: '⧗',
  ALREADY_REDEEMED: '↺',
  WRONG_OFFER_LOCATION: '⌘',
  MANUAL_REVIEW: '⚑',
  NOT_FOUND: '?',
};

export default function MerchantApp() {
  const [auth, setAuth] = useState(staffToken.get());
  return auth
    ? <Validator auth={auth} onLogout={() => { staffToken.set(null); setAuth(null); }} />
    : <Login onIn={(a) => { staffToken.set(a); setAuth(a); }} />;
}

function Login({ onIn }) {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      onIn(await merchantApi.login(staffId.trim(), pin));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401
        ? 'معرّف الموظف أو الرمز غير صحيح.'
        : 'تعذّر تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="topbar">
          <div className="topbar__brand">تحقق التاجر · فان أور</div>
        </header>

        <form className="screen stack" onSubmit={submit}>
          <div className="stack-s">
            <h1>تسجيل دخول الموظف</h1>
            <p className="lede">هذه الشاشة لموظفي الفرع فقط.</p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="staffId">معرّف الموظف</label>
            <input id="staffId" className="input" dir="ltr" autoComplete="username"
                   value={staffId} onChange={(e) => setStaffId(e.target.value)} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="pin">الرمز السري</label>
            <input id="pin" className="input input--code" type="password" inputMode="numeric"
                   autoComplete="current-password" maxLength={8}
                   value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>

          {error && <Notice tone="err">{error}</Notice>}

          <Button type="submit" disabled={!staffId || !pin || busy}>
            {busy ? 'جارٍ الدخول…' : 'دخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Validator({ auth, onLogout }) {
  const [code, setCode] = useState('');
  const [check, setCheck] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    merchantApi.activity().then(setActivity).catch(() => {});
  }, [done]);

  async function validate(e) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true); setError(null); setDone(null);
    try {
      setCheck(await merchantApi.validate(code.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر التحقق.');
      setCheck(null);
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await merchantApi.redeem(code.trim());
      setDone(res);
      setCheck(null);
      setCode('');
    } catch (err) {
      // A double-tap lands here rather than creating a second redemption.
      setError(err instanceof ApiError ? err.message : 'تعذّر إتمام العملية.');
      setCheck(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCode(''); setCheck(null); setDone(null); setError(null);
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="topbar">
          <div className="topbar__brand">تحقق التاجر</div>
          <span className="topbar__club">{auth.outlet?.name_ar}</span>
        </header>

        <div className="screen stack">
          <form className="stack" onSubmit={validate}>
            <div className="field">
              <label className="field__label" htmlFor="code">رمز المزية</label>
              <input
                id="code"
                className="input input--code"
                dir="ltr"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="XXXX-XXXX"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setCheck(null); setDone(null); }}
                autoFocus
              />
              <span className="field__hint">
                امسح رمز QR من جوال العميل، أو اكتب الرمز المكوّن من ٨ خانات.
              </span>
            </div>

            <Button type="submit" disabled={!code.trim() || busy}>
              {busy ? 'جارٍ الفحص…' : 'افحص الرمز'}
            </Button>
          </form>

          {error && <Notice tone="err">{error}</Notice>}

          {done && (
            <>
              <Notice tone="ok" icon="✓">{done.message_ar}</Notice>
              <Button variant="secondary" onClick={reset}>فحص رمز آخر</Button>
            </>
          )}

          {check && (
            <div className="stack">
              {/* Verdict carries an icon and a written label — never colour alone. */}
              <Notice tone={RESULT_TONE[check.result] || 'warn'} icon={RESULT_ICON[check.result]}>
                <strong>{check.label_ar}</strong>
              </Notice>

              {check.offer && (
                <div className="card stack-s">
                  <h2>{check.offer.title_ar}</h2>
                  <p>{check.offer.benefit_ar}</p>
                  <p className="muted">{check.offer.sponsor_name_ar}</p>
                  {check.offer.excluded_ar && (
                    <p className="muted">الاستثناءات: {check.offer.excluded_ar}</p>
                  )}
                </div>
              )}

              {check.canConfirm ? (
                <Button onClick={redeem} disabled={busy}>
                  {busy ? 'جارٍ التأكيد…' : 'سلّمت المزية — أكّد الاستخدام'}
                </Button>
              ) : (
                <Button variant="secondary" onClick={reset}>فحص رمز آخر</Button>
              )}
            </div>
          )}

          <hr className="divider" />

          <div className="card card--quiet stack-s">
            <h3>عمليات اليوم</h3>
            <p className="muted">
              عدد المزايا المصروفة خلال ٢٤ ساعة:{' '}
              <span className="num">{activity?.count ?? 0}</span>
            </p>
          </div>

          <button type="button" className="btn btn--ghost" onClick={onLogout}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}
