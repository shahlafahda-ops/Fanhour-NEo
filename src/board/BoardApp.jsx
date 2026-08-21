import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

/*
 * Live value board — the projector surface for the demo.
 *
 * Narrative in three beats, left to right in RTL:
 *   1. التفاعل موجود        the engagement the room is generating right now
 *   2. كيف يتحول إلى قيمة؟   the conversion question
 *   3. القيمة                verified fans, local share, validated redemptions
 *
 * Everything shown is aggregate. No fan is identifiable from this screen, which
 * is what makes it safe to put on a wall in front of an audience.
 */

const POLL_MS = 2000;

const EVENT_AR = {
  challenge_start: 'مشجّع بدأ التحدي',
  challenge_complete: 'مشجّع أكمل التحدي',
  claim_issued: 'مزية صدرت لمشجّع موثّق',
  redemption_complete: 'استخدام مؤكد لدى التاجر',
};

const EVENT_ICON = {
  challenge_start: '▶',
  challenge_complete: '✓',
  claim_issued: '◆',
  redemption_complete: '★',
};

export default function BoardApp() {
  const key = new URLSearchParams(window.location.search).get('k') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [qr, setQr] = useState(null);

  useEffect(() => {
    const joinUrl = `${window.location.origin}/?src=board`;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 520, color: { dark: '#0B2A4A', light: '#FFFFFF' } })
      .then(setQr).catch(() => setQr(false));
  }, []);

  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const res = await fetch(`/api/board?k=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح العرض غير صحيح' : 'تعذّر تحميل البيانات');
        const json = await res.json();
        if (alive) { setData(json); setError(null); }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) timer = setTimeout(tick, POLL_MS);
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [key]);

  if (error && !data) {
    return <div className="board board--empty"><p>{error}</p></div>;
  }
  if (!data) {
    return <div className="board board--empty"><p>جارٍ التحميل…</p></div>;
  }

  const { engagement, value, recent } = data;

  return (
    <div className="board">
      <header className="board__top">
        <div className="board__brand">فان أور × الحزم</div>
        <div className="board__live">
          <span className="board__dot" aria-hidden="true" />
          مباشر
        </div>
      </header>

      <div className="board__grid">
        {/* Beat 1 — the engagement that already exists. */}
        <section className="board__panel">
          <h2 className="board__panelTitle">التفاعل موجود</h2>
          <Metric big value={engagement.completions} label="مشجّع أكمل التحدي" />
          <div className="board__row">
            <Metric value={engagement.starts} label="بدأوا التحدي" />
            <Metric value={engagement.answers} label="إجابة مُسجّلة" />
          </div>
          {engagement.completionRate != null && (
            <p className="board__note">
              نسبة الإكمال <span className="num">{Math.round(engagement.completionRate * 100)}%</span>
            </p>
          )}
        </section>

        {/* Beat 2 — the question the whole product answers. */}
        <section className="board__bridge">
          <div className="board__arrow" aria-hidden="true">←</div>
          <p className="board__question">لكن كيف يتحول إلى قيمة؟</p>
          <div className="board__joinBox">
            {qr && <img className="board__qr" src={qr} alt="امسح للمشاركة في التحدي" />}
            <p className="board__joinText">امسح وشارك الآن</p>
          </div>
        </section>

        {/* Beat 3 — what it converted into. */}
        <section className="board__panel board__panel--value">
          <h2 className="board__panelTitle">القيمة</h2>
          <Metric big value={value.redemptions} label="استخدام مؤكد لدى التاجر" accent />
          <div className="board__row">
            <Metric value={value.verifiedFans} label="مشجّع موثّق" />
            <Metric value={value.claims} label="مزية صدرت" />
          </div>
          <div className="board__local">
            <span className="board__localLabel">من الرس والقصيم</span>
            <span className="board__localValue num">{value.qassimRelevant}</span>
          </div>
          <LocalitySplit byLocality={value.byLocality} total={value.verifiedFans} />
        </section>
      </div>

      <footer className="board__ticker">
        <div className="board__tickerInner">
          {recent.length === 0
            ? <span className="board__tickerItem">في انتظار أول مشارك…</span>
            : recent.map((e, i) => (
                <span className="board__tickerItem" key={`${e.occurred_at}-${i}`}>
                  <span aria-hidden="true">{EVENT_ICON[e.name]}</span> {EVENT_AR[e.name] || e.name}
                </span>
              ))}
        </div>
      </footer>

      <p className="board__disclaimer">
        جميع الأرقام تجميعية. لا تظهر هنا أي بيانات شخصية لأي مشجّع.
      </p>
    </div>
  );
}

/** Counts animate upward so a change is visible from the back of a room. */
function Metric({ value, label, big, accent }) {
  const shown = useCountUp(value);
  return (
    <div className={`metric ${big ? 'metric--big' : ''} ${accent ? 'metric--accent' : ''}`}>
      <div className="metric__value num">{shown}</div>
      <div className="metric__label">{label}</div>
    </div>
  );
}

function useCountUp(target) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target) return undefined;
    const duration = 600;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}

const LOCALITY_AR = {
  al_rass: 'الرس',
  qassim_other: 'القصيم',
  ksa_other: 'السعودية',
  outside_ksa: 'خارج السعودية',
};

function LocalitySplit({ byLocality, total }) {
  if (!total) return null;
  const order = ['al_rass', 'qassim_other', 'ksa_other', 'outside_ksa'];
  return (
    <div className="split">
      <div className="split__bar">
        {order.map((k) => {
          const n = byLocality[k] || 0;
          if (!n) return null;
          return (
            <div
              key={k}
              className={`split__seg split__seg--${k}`}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${LOCALITY_AR[k]}: ${n}`}
            />
          );
        })}
      </div>
      <div className="split__legend">
        {order.filter((k) => byLocality[k]).map((k) => (
          <span className="split__item" key={k}>
            <i className={`split__swatch split__seg--${k}`} aria-hidden="true" />
            {LOCALITY_AR[k]} <span className="num">{byLocality[k]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
