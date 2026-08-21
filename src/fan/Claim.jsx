import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Notice, Countdown, Button } from '../lib/ui.jsx';

/*
 * Issued claim.
 *
 * The QR and the short code both resolve to the same single-use server token,
 * so a screenshot is harmless: the second presentation is rejected server-side.
 * The short code exists because the spec requires a typed fallback when a
 * merchant's camera fails.
 */
export default function Claim({ claim, onDone, alreadyClaimed }) {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(claim.shortCode, {
      margin: 1,
      width: 416,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B2A4A', light: '#FFFFFF' },
    })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(false); });
    return () => { alive = false; };
  }, [claim.shortCode]);

  const redeemed = claim.state === 'REDEEMED';

  return (
    <div className="screen stack">
      <div className="stack-s">
        <span className="eyebrow">مزيتك جاهزة</span>
        <h1>{claim.offer?.title_ar}</h1>
        <p className="lede">{claim.offer?.benefit_ar}</p>
      </div>

      {alreadyClaimed && (
        <Notice tone="info">
          سبق أن حصلت على هذه المزية. هذه هي نفس المزية، ولا تُصرف أكثر من مرة.
        </Notice>
      )}

      {redeemed ? (
        <Notice tone="ok">تم استخدام هذه المزية.</Notice>
      ) : (
        <div className="ticket">
          <div className="ticket__head">
            <strong>{claim.offer?.sponsor_name_ar}</strong>
            <div style={{ fontSize: 13, opacity: .85 }}>اعرض هذا الرمز عند الكاشير</div>
          </div>

          <div className="ticket__body">
            {qr
              ? <img className="ticket__qr" src={qr} alt={`رمز الاستفادة ${claim.shortCode}`} />
              : <div className="skeleton ticket__qr" aria-hidden="true" />}

            <div className="stack-s" style={{ alignItems: 'center' }}>
              <span className="muted">أو أملِ هذا الرمز على الموظف</span>
              <span className="ticket__code">{claim.shortCode}</span>
            </div>
          </div>

          <div className="ticket__foot stack-s">
            <p className="muted"><Countdown to={claim.expiresAt} /></p>
            <p className="muted">أوقات الاستفادة: {claim.offer?.valid_hours_ar}</p>
          </div>
        </div>
      )}

      <div className="card card--quiet stack-s">
        <h3>الشروط</h3>
        <p className="muted">{claim.offer?.terms_ar}</p>
        {claim.offer?.excluded_ar && <p className="muted">الاستثناءات: {claim.offer.excluded_ar}</p>}
        <p className="muted">
          لأي مشكلة في الاستفادة: <span className="num">{claim.offer?.escalation_contact}</span>
        </p>
      </div>

      <Notice tone="info">
        هذه المزية يقدّمها ويُنفّذها {claim.offer?.sponsor_name_ar}. فان أور تتحقق من الاستفادة فقط.
      </Notice>

      <Button variant="secondary" onClick={onDone}>تم</Button>
    </div>
  );
}
