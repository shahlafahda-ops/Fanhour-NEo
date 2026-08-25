import { useState, useEffect } from 'react';
import { C, FONT } from '../brand.js';
import { Logo } from '../components/UI.jsx';

const STEPS = [
  {
    icon: '⚡',
    title: 'Earn XP Every Day',
    body: 'Read match previews, vote in polls, make predictions. Earn points just by being a fan — even in the off-season.',
    color: C.green,
  },
  {
    icon: '🏟',
    title: 'Matchday Goes Digital',
    body: 'AR Fan Cam on the Jumbotron, Halftime Treasure Hunts, live Man of the Match polls. King Khalid Stadium, amplified.',
    color: C.purple,
  },
  {
    icon: '🏪',
    title: 'Local Businesses Win Too',
    body: 'Tabuk restaurants, hotels, and shops can sponsor a single goal replay for SAR 5,000. Your support powers them.',
    color: C.green,
  },
  {
    icon: '🏆',
    title: 'Wahdat NEOM Awaits',
    body: "Climb the Wahdat NEOM leaderboard. Unlock badges, digital collectibles, and exclusive fan passes for NEOM's first SPL season.",
    color: C.purple,
  },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Auto-advance dots only — user must tap Next to proceed
  const next = () => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      if (step < STEPS.length - 1) {
        setStep(s => s + 1);
        setAnimating(false);
      } else {
        onComplete();
      }
    }, 200);
  };

  const skip = () => onComplete();

  const s = STEPS[step];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: C.black,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 28px 48px',
      zIndex: 999,
      overflow: 'hidden',
    }}>
      {/* Animated background rings */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '38%',
            width: 300, height: 300,
            marginLeft: -150, marginTop: -150,
            borderRadius: '50%',
            border: `1.5px solid ${s.color}`,
            opacity: 0.12,
            animation: `sonic-wave 4s ease-out ${i * 1}s infinite`,
          }} />
        ))}
      </div>

      {/* Top: logo + skip */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={28} />
          <span style={{ fontWeight: 800, fontSize: 16, fontFamily: FONT.main }}>
            Fan<span style={{ color: C.green }}>Hour</span>
          </span>
        </div>
        <button
          onClick={skip}
          style={{
            background: 'none', border: 'none',
            color: C.muted, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT.main,
          }}
        >Skip →</button>
      </div>

      {/* Centre: icon + text */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 24, textAlign: 'center',
        animation: 'slide-up 0.4s ease both',
        key: step,
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: 28,
          background: `linear-gradient(135deg, ${s.color}33, ${s.color}11)`,
          border: `2px solid ${s.color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48,
          boxShadow: `0 0 40px ${s.color}44`,
          transition: 'all 0.4s ease',
        }}>{s.icon}</div>

        <div>
          <div style={{
            fontSize: 26, fontWeight: 800, marginBottom: 12,
            lineHeight: 1.2,
          }}>{s.title}</div>
          <div style={{
            fontSize: 15, color: C.muted, lineHeight: 1.7,
            maxWidth: 320,
          }}>{s.body}</div>
        </div>
      </div>

      {/* Bottom: dots + button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%' }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8,
              height: 8, borderRadius: 999,
              background: i === step ? s.color : C.border,
              boxShadow: i === step ? `0 0 8px ${s.color}` : 'none',
              transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              cursor: 'pointer',
            }} onClick={() => setStep(i)} />
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={next}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${s.color}, ${step % 2 === 0 ? C.purple : C.green})`,
            border: 'none',
            color: step % 2 === 0 ? C.black : C.white,
            fontSize: 16, fontWeight: 800,
            padding: '18px', borderRadius: 16,
            cursor: 'pointer',
            fontFamily: FONT.main,
            boxShadow: `0 8px 32px ${s.color}55`,
            transition: 'all 0.2s',
            letterSpacing: 0.3,
          }}
        >
          {step < STEPS.length - 1 ? 'Continue →' : "Let's Go ⚡"}
        </button>

        <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
          By continuing you agree to FanHour's Terms of Use<br />
          Data processed under Saudi PDPL · NEOM Club retains 100% ownership
        </div>
      </div>
    </div>
  );
}
