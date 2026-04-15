import { C, FONT } from '../brand.js';

/* ─── LOGO SVG ─────────────────────────────────────────────────── */
export function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.green} />
          <stop offset="1" stopColor={C.purple} />
        </linearGradient>
      </defs>
      <path d="M20 2 L34 11 L34 22 L20 20 L6 22 L6 11 Z" fill="url(#logoGrad)" opacity="0.9" />
      <path d="M20 38 L6 29 L6 18 L20 20 L34 18 L34 29 Z" fill="url(#logoGrad)" opacity="0.65" />
      <circle cx="28" cy="8"  r="1.5" fill={C.green} opacity="0.9" />
      <circle cx="30" cy="11" r="1.0" fill={C.green} opacity="0.7" />
      <circle cx="32" cy="9"  r="0.7" fill={C.green} opacity="0.5" />
    </svg>
  );
}

/* ─── SONIC PULSE BG ───────────────────────────────────────────── */
export function SonicBg({ x = '50%', y = '50%', color = C.purple, opacity = 0.15 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          position: 'absolute', left: x, top: y,
          width: 200, height: 200, marginLeft: -100, marginTop: -100,
          borderRadius: '50%', border: `1.5px solid ${color}`,
          opacity,
          animation: `sonic-wave 4s ease-out ${i * 1}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── PILL TAG ─────────────────────────────────────────────────── */
export function Pill({ label, color = C.green, small = false }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 999,
      background: `${color}22`,
      border: `1px solid ${color}44`,
      color,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      letterSpacing: 0.4,
      fontFamily: FONT.main,
    }}>{label}</span>
  );
}

/* ─── XP PROGRESS BAR ──────────────────────────────────────────── */
export function XPBar({ current, max, label, color = C.green, height = 6 }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: C.muted }}>
          <span>{label}</span>
          <span style={{ color, fontFamily: FONT.mono }}>
            {current.toLocaleString()} / {max.toLocaleString()} XP
          </span>
        </div>
      )}
      <div style={{ background: C.border, borderRadius: 999, height, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}CC)`,
          boxShadow: `0 0 10px ${color}88`,
          transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
    </div>
  );
}

/* ─── STAT CARD ────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, color = C.green, icon, delay = 0 }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16, padding: '16px 18px',
      animation: `slide-up 0.5s ease ${delay}s both`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
      }} />
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{
        fontSize: 24, fontWeight: 700, color,
        fontFamily: FONT.mono, letterSpacing: -1,
      }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.green, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

/* ─── BADGE ────────────────────────────────────────────────────── */
export function Badge({ icon, label, earned, delay = 0 }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      animation: earned ? `badge-pop 0.5s ease ${delay}s both` : 'none',
      opacity: earned ? 1 : 0.28,
      filter: earned ? 'none' : 'grayscale(1)',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: earned ? `linear-gradient(135deg, ${C.purple}44, ${C.green}22)` : C.card,
        border: `2px solid ${earned ? C.green + '88' : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        boxShadow: earned ? `0 0 14px ${C.green}44` : 'none',
      }}>{icon}</div>
      <span style={{
        fontSize: 9.5, color: earned ? C.white : C.muted,
        textAlign: 'center', maxWidth: 56, fontWeight: 600, lineHeight: 1.3,
      }}>{label}</span>
    </div>
  );
}

/* ─── LIVE DOT ─────────────────────────────────────────────────── */
export function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.red, fontWeight: 700 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: C.red,
        animation: 'live-dot 1s ease infinite', display: 'inline-block',
      }} />
      LIVE
    </span>
  );
}

/* ─── SECTION HEADER ───────────────────────────────────────────── */
export function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 3 }}>
        {sub}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

/* ─── CARD WRAPPER ─────────────────────────────────────────────── */
export function Card({ children, style = {}, glowColor }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${glowColor ? glowColor + '44' : C.border}`,
      borderRadius: 18, padding: 18,
      boxShadow: glowColor ? `0 0 20px ${glowColor}18` : 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── XP TOAST ─────────────────────────────────────────────────── */
export function XPToast({ amount, visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', top: '20%', left: '50%',
      transform: 'translateX(-50%)',
      background: `linear-gradient(90deg, ${C.green}EE, ${C.purple}EE)`,
      color: C.white, fontWeight: 800, fontSize: 18,
      padding: '10px 24px', borderRadius: 999,
      animation: 'xp-toast 1.5s ease forwards',
      pointerEvents: 'none', zIndex: 9999,
      fontFamily: FONT.mono,
      boxShadow: `0 0 30px ${C.green}88`,
    }}>
      +{amount} XP ⚡
    </div>
  );
}
