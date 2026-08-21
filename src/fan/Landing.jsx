import { Button, Notice, Countdown } from '../lib/ui.jsx';

/*
 * Landing.
 *
 * Club relevance leads and the sponsor benefit is secondary — the spec is
 * explicit that this must feel like "تحدي الحزم على FanHour", not a coupon page
 * with a football logo. Curiosity before incentive.
 */

const HOME_AWAY_AR = { home: 'على أرضه', away: 'خارج أرضه' };

function fixtureLine(fixture) {
  const side = HOME_AWAY_AR[fixture.home_away] || '';
  return `الحزم ضد ${fixture.opponent_ar} — ${side}`;
}

function kickoffAr(iso) {
  const d = new Date(`${String(iso).replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Force the Gregorian calendar: ar-SA defaults to Hijri, but the fixture list
  // is keyed to the official Gregorian SAFF/RSL schedule.
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
}

export default function Landing({ data, onStart, starting }) {
  if (!data.open) {
    const next = data.nextFixture;
    return (
      <div className="screen stack">
        <div className="stack-s">
          <span className="eyebrow">تحدي الحزم</span>
          <h1>لا يوجد تحدٍ مفتوح حاليًا</h1>
          <p className="lede">{data.message_ar}</p>
        </div>

        {next && (
          <div className="card card--accent stack-s">
            <span className="eyebrow">الجولة القادمة</span>
            <h2>{fixtureLine(next)}</h2>
            <p className="muted">{kickoffAr(next.kickoff_at)}</p>
            {!next.opponent_confirmed && (
              <p className="muted">يُعتمد الخصم النهائي من الجدول الرسمي.</p>
            )}
          </div>
        )}

        {/* No artificial activity during league gaps (section 9). */}
        <Notice tone="info">
          نُطلق تحديًا واحدًا مع كل جولة من جولات الحزم — ولا نصنع تحديات وهمية بين الجولات.
        </Notice>
      </div>
    );
  }

  const { challenge, offerTeaser, questionCount } = data;

  return (
    <div className="screen stack">
      <div className="stack-s">
        <span className="eyebrow">تحدي الحزم · {challenge.fixture.matchweek}</span>
        <h1>{challenge.title_ar}</h1>
        <p className="lede">{fixtureLine(challenge.fixture)}</p>
        <p className="muted">{kickoffAr(challenge.fixture.kickoff_at)}</p>
      </div>

      <div className="card card--accent stack-s">
        <h2>{questionCount} أسئلة عن الحزم</h2>
        <p>اختبر معرفتك بالفارس. أقل من دقيقة، وبدون تسجيل أو رقم جوال.</p>
        <p className="muted">
          <Countdown to={challenge.closes_at} prefix="يُغلق التحدي خلال" />
        </p>
      </div>

      <Button onClick={onStart} disabled={starting}>
        {starting ? 'جارٍ الفتح…' : 'ابدأ التحدي'}
      </Button>

      {/* Teased, never the hero. */}
      {offerTeaser && (
        <p className="muted" style={{ textAlign: 'center' }}>
          بعد النتيجة، مزية من {offerTeaser.sponsor_name_ar} لكل من يُكمل التحدي.
        </p>
      )}

      <hr className="divider" />
      <p className="muted">
        لا نطلب موقعك الجغرافي ولا عنوانك. تُجمع البيانات وفق نظام حماية البيانات الشخصية السعودي.
      </p>
    </div>
  );
}
