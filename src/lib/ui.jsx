/*
 * Shared primitives.
 *
 * Every status here pairs an icon with a text label. The spec requires that
 * state is never conveyed by colour alone, so no component signals meaning
 * through its palette by itself.
 */

export function Notice({ tone = 'info', icon, children }) {
  const icons = { info: 'ℹ', ok: '✓', warn: '!', err: '✕' };
  const roles = { err: 'alert', warn: 'alert' };
  return (
    <div className={`notice notice--${tone}`} role={roles[tone] || 'status'}>
      <span className="notice__icon" aria-hidden="true">{icon || icons[tone]}</span>
      <div>{children}</div>
    </div>
  );
}

export function Button({ variant = 'primary', children, ...props }) {
  return <button className={`btn btn--${variant}`} {...props}>{children}</button>;
}

export function Progress({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="progress">
      <div className="progress__track">
        <div
          className="progress__fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`السؤال ${current} من ${total}`}
        />
      </div>
      {/* Makes the task legible — B9 requires visible 1/3, 2/3, 3/3 progress. */}
      <span className="progress__label num">{current}/{total}</span>
    </div>
  );
}

export function TopBar({ subtitle }) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Crest />
        <span>فان أور × الحزم</span>
      </div>
      {subtitle && <span className="topbar__club">{subtitle}</span>}
    </header>
  );
}

function Crest() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2l8 3.2v6.1c0 4.6-3.2 8.7-8 10.7-4.8-2-8-6.1-8-10.7V5.2L12 2z"
            fill="#fff" opacity=".18" />
      <path d="M12 2l8 3.2v6.1c0 4.6-3.2 8.7-8 10.7-4.8-2-8-6.1-8-10.7V5.2L12 2z"
            fill="none" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="3.1" fill="none" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

export function Spinner({ label = 'جارٍ التحميل…' }) {
  return (
    <div className="stack" style={{ padding: '32px 0' }} aria-busy="true">
      <div className="skeleton" style={{ height: 22, width: '62%' }} />
      <div className="skeleton" style={{ height: 15, width: '88%' }} />
      <div className="skeleton" style={{ height: 15, width: '74%' }} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Arabic has a dual form and a distinct plural for 3–10, so a single noun
 * string reads as broken Arabic ("6 يوم"). Pick the right form by count.
 */
function plural(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

// Dual forms are genitive: the countdown always follows the preposition "خلال".
const DAYS = ['يوم واحد', 'يومين', 'أيام', 'يومًا'];
const HOURS = ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'];
const MINS = ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'];

/** Truthful countdown. Only ever rendered against a real server-side expiry —
 *  the spec forbids manufacturing urgency. */
export function Countdown({ to, prefix = 'تنتهي الصلاحية خلال' }) {
  const ms = new Date(`${String(to).replace(' ', 'T')}Z`).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return <span className="muted">انتهت الصلاحية</span>;

  const totalHours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);

  let text;
  if (totalHours >= 24) text = plural(Math.floor(totalHours / 24), DAYS);
  else if (totalHours >= 1) text = `${plural(totalHours, HOURS)} و${plural(mins, MINS)}`;
  else text = plural(mins, MINS);

  return <span className="muted">{prefix} {text}</span>;
}

export const LOCALITY_LABELS = {
  al_rass: 'الرس',
  qassim_other: 'مكان آخر في القصيم',
  ksa_other: 'مكان آخر في السعودية',
  outside_ksa: 'خارج السعودية',
};
