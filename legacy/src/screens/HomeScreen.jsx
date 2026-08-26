import { useState, useEffect } from 'react';
import { C, FONT } from '../brand.js';
import { SonicBg, Pill, XPBar, StatCard, Logo } from '../components/UI.jsx';

export default function HomeScreen({ xp }) {
  const [countdown, setCountdown] = useState({ d: 3, h: 14, m: 22, s: 8 });

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(p => {
        let { d, h, m, s } = p;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; d--; }
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="85%" y="15%" color={C.purple} opacity={0.12} />
      <SonicBg x="15%" y="85%" color={C.green}  opacity={0.08} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2, letterSpacing: 1, fontWeight: 600 }}>WELCOME BACK</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            Wahdat <span style={{ color: C.green }}>NEOM</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: C.greenDim,
            border: `1px solid ${C.green}44`,
            borderRadius: 10, padding: '6px 12px',
            fontSize: 13, fontWeight: 700, color: C.green,
            fontFamily: FONT.mono,
          }}>
            ⚡ {xp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* Next Match Countdown */}
      <div style={{
        background: `linear-gradient(135deg, ${C.card}, #1A1A2E)`,
        border: `1px solid ${C.border}`,
        borderRadius: 20, padding: 20,
        position: 'relative', overflow: 'hidden',
        marginBottom: 20,
      }}>
        <SonicBg x="90%" y="50%" color={C.green} opacity={0.14} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <Pill label="NEXT MATCH" />
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>NEOM FC vs Al-Qadsiah</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>King Khalid Sports City · Tabuk</div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.purple}44, ${C.green}22)`,
            border: `1px solid ${C.green}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>⚽</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            [countdown.d, 'DAYS'],
            [countdown.h, 'HRS'],
            [countdown.m, 'MIN'],
            [String(countdown.s).padStart(2, '0'), 'SEC'],
          ].map(([val, unit]) => (
            <div key={unit} style={{
              flex: 1, background: C.card2, borderRadius: 10,
              padding: '10px 6px', textAlign: 'center',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{
                fontSize: 22, fontWeight: 700,
                fontFamily: FONT.mono, color: C.green,
              }}>
                {String(val).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginTop: 2 }}>{unit}</div>
            </div>
          ))}
        </div>
        <XPBar current={300} max={500} label="Matchday XP Potential" />
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <StatCard label="Fan Rank"      value="#127"  sub="↑ 23 this week"    icon="🏆" color={C.green}  delay={0.05} />
        <StatCard label="Badges Earned" value="8/24"  sub="2 new available"   icon="🏅" color={C.purple} delay={0.1}  />
        <StatCard label="Attendance"    value="+32%"  sub="vs last season"    icon="🏟" color={C.green}  delay={0.15} />
        <StatCard label="Merch Bonus"   value="+45%"  sub="Points-to-purchase" icon="🛍" color={C.purple} delay={0.2}  />
      </div>

      {/* Season Progress */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Season Progress · 2025/26 SPL</div>
        {[
          { label: 'Fan Engagement Score', val: 7400, max: 10000, color: C.green  },
          { label: 'Wahdat NEOM Tier',     val: 3200, max: 5000,  color: C.purple },
          { label: 'Off-Season Activity',  val: 1800, max: 3000,  color: '#00BCD4' },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: i < 2 ? 14 : 0 }}>
            <XPBar
              current={item.val}
              max={item.max}
              label={item.label}
              color={item.color}
            />
          </div>
        ))}
      </div>

      {/* Vision 2030 */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purple}22, ${C.green}11)`,
        border: `1px solid ${C.purple}44`,
        borderRadius: 18, padding: 18,
      }}>
        <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, letterSpacing: 1.2, marginBottom: 6 }}>
          ⚙ VISION 2030 ALIGNED
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Digital Dynasty Engine</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { v: '25K–50K', l: 'Target\nDigital Fans' },
            { v: 'SAR 825K', l: 'Optimistic\nYear 1 Rev' },
            { v: '50–100', l: 'Active SME\nPartners' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: C.green,
                fontFamily: FONT.mono, lineHeight: 1.2,
              }}>{s.v}</div>
              <div style={{
                fontSize: 9.5, color: C.muted, marginTop: 4,
                whiteSpace: 'pre-line', lineHeight: 1.4,
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
