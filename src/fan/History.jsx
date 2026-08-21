import { Button } from '../lib/ui.jsx';

/*
 * Personal history and the next-fixture return cue.
 *
 * The habit cue is the football calendar, not a daily streak — the spec
 * explicitly rejects streaks because fixture gaps make them misleading.
 */
const HOME_AWAY_AR = { home: 'على أرضه', away: 'خارج أرضه' };

const CLAIM_STATE_AR = {
  ISSUED: 'جاهزة للاستخدام',
  REDEEMED: 'تم استخدامها',
  EXPIRED: 'منتهية',
  VOID: 'ملغاة',
  MANUAL_REVIEW: 'قيد المراجعة',
};

export default function History({ data, onReplay }) {
  const next = data.nextFixture;

  return (
    <div className="screen stack">
      <div className="stack-s">
        <span className="eyebrow">سجلّك</span>
        <h1>تحدياتك مع الحزم</h1>
      </div>

      {!data.verified && (
        <p className="lede">
          يظهر سجلّك بعد التحقق من رقم جوالك عند طلب مزية.
        </p>
      )}

      {data.verified && data.history.length > 0 && (
        <div className="card stack-s">
          <h2>النتائج</h2>
          {data.history.map((h) => (
            <div className="rank" key={h.pilot_index}>
              <span className="rank__name">
                الحزم ضد {h.opponent_ar}
                <span className="muted"> · {HOME_AWAY_AR[h.home_away]}</span>
              </span>
              <span className="rank__score num">{h.score}/3</span>
            </div>
          ))}
        </div>
      )}

      {data.verified && data.claims?.length > 0 && (
        <div className="card stack-s">
          <h2>المزايا</h2>
          {data.claims.map((c) => (
            <div className="rank" key={c.short_code}>
              <span className="rank__name">
                {c.title_ar}
                <span className="muted"> · {c.sponsor_name_ar}</span>
              </span>
              <span className="pill">{CLAIM_STATE_AR[c.state] || c.state}</span>
            </div>
          ))}
        </div>
      )}

      {next && (
        <div className="card card--accent stack-s">
          <span className="eyebrow">الجولة القادمة</span>
          <h2>الحزم ضد {next.opponent_ar}</h2>
          <p className="muted">{HOME_AWAY_AR[next.home_away]}</p>
          {!next.opponent_confirmed && (
            <p className="muted">يُعتمد الخصم النهائي من الجدول الرسمي.</p>
          )}
        </div>
      )}

      <Button variant="secondary" onClick={onReplay}>العودة للبداية</Button>
    </div>
  );
}
