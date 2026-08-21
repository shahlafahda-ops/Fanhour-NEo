import { Button, Notice, Countdown } from '../lib/ui.jsx';

/*
 * Sponsor benefit reveal.
 *
 * Shown after the result and independent of the score. Material terms are
 * visible before the fan expresses claim intent — no hidden scroll traps, and
 * the score-independence is stated in plain Arabic rather than implied.
 */
export default function Offer({ offer, availability, independenceNote, onClaim, onSkip, busy }) {
  if (!offer) {
    return (
      <div className="screen stack">
        <h1>شكرًا لمشاركتك</h1>
        <p className="lede">لا توجد مزية مرتبطة بهذا التحدي.</p>
        <Button variant="secondary" onClick={onSkip}>تابع</Button>
      </div>
    );
  }

  const unavailableReason = {
    CAP_REACHED: 'انتهت الكمية المتاحة من هذه المزية.',
    EXPIRED: 'انتهت صلاحية هذه المزية.',
    INACTIVE: 'هذه المزية غير مفعّلة حاليًا.',
    NO_OFFER: 'لا توجد مزية متاحة.',
  }[availability?.reason];

  return (
    <div className="screen stack">
      <div className="stack-s">
        <span className="eyebrow">مزية من {offer.sponsor_name_ar}</span>
        <h1>{offer.title_ar}</h1>
        <p className="lede">{offer.benefit_ar}</p>
      </div>

      <Notice tone="ok">{independenceNote}</Notice>

      <div className="card stack-s">
        <h2>الشروط</h2>
        <p>{offer.terms_ar}</p>
        {offer.excluded_ar && (
          <>
            <hr className="divider" />
            <h3>الاستثناءات</h3>
            <p className="muted">{offer.excluded_ar}</p>
          </>
        )}
        <hr className="divider" />
        <p className="muted">أوقات الاستفادة: {offer.valid_hours_ar}</p>
        <p className="muted"><Countdown to={offer.expires_at} /></p>
        {/* Real merchant capacity, not a manufactured scarcity counter. */}
        {availability?.available && availability.remaining <= 20 && (
          <p className="muted">
            المتبقي من الكمية: <span className="num">{availability.remaining}</span>
          </p>
        )}
      </div>

      {availability?.available ? (
        <>
          <Button onClick={onClaim} disabled={busy}>
            {busy ? 'جارٍ المتابعة…' : 'أريد الحصول على المزية'}
          </Button>
          <p className="muted" style={{ textAlign: 'center' }}>
            للحصول على المزية سنطلب تأكيد أنك 18 سنة فأكثر، ومنطقة سكنك، ورقم جوالك.
          </p>
        </>
      ) : (
        <Notice tone="warn">{unavailableReason || 'المزية غير متاحة حاليًا.'}</Notice>
      )}

      <button type="button" className="btn btn--ghost" onClick={onSkip}>
        لا شكرًا، تابع بدون المزية
      </button>
    </div>
  );
}
