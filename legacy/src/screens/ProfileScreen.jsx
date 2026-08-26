import { C, FONT } from '../brand.js';
import { SonicBg, XPBar, Pill } from '../components/UI.jsx';

export default function ProfileScreen({ xp }) {
  const level      = Math.max(1, Math.floor(xp / 500) + 1);
  const nextXp     = level * 500;
  const prevXp     = (level - 1) * 500;
  const levelPct   = Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100);

  const leaderboard = [
    { rank: 1,   name: 'AbdulRahman A.', xp: 18420, badge: '💎' },
    { rank: 2,   name: 'Mohammed K.',    xp: 16300, badge: '🥈' },
    { rank: 3,   name: 'Sara N.',        xp: 14980, badge: '🥉' },
    { rank: 127, name: 'You',            xp,        badge: '⚡', highlight: true },
  ];

  const monthlyXP = [1200, 980, 1480, 760, 1840, 1320];
  const monthLabels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const maxMonthly  = Math.max(...monthlyXP);

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="50%" y="20%" color={C.purple} opacity={0.12} />

      {/* Profile Card */}
      <div style={{
        background: `linear-gradient(135deg, #1A1A2E, ${C.card})`,
        border: `1px solid ${C.border}`,
        borderRadius: 22, padding: 22,
        position: 'relative', overflow: 'hidden', marginBottom: 18,
      }}>
        <SonicBg x="85%" y="30%" color={C.purple} opacity={0.18} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{
            width: 66, height: 66, borderRadius: 20,
            background: `linear-gradient(135deg, ${C.purple}, ${C.green})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, flexShrink: 0,
            boxShadow: `0 0 24px ${C.purple}55`,
          }}>⚡</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Aizz</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Wahdat NEOM Supporter</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill label={`Lvl ${level}`}  color={C.purple} />
              <Pill label="Top 200"         color={C.green}  />
              <Pill label="Season 2025/26"  color={C.muted}  />
            </div>
          </div>
        </div>

        {/* Level Bar */}
        <div style={{ marginBottom: 4 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: C.muted, marginBottom: 6,
          }}>
            <span>Level {level} → {level + 1}</span>
            <span style={{ color: C.purple, fontFamily: FONT.mono }}>
              {xp} / {nextXp} XP
            </span>
          </div>
          <div style={{ background: C.border, borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              background: `linear-gradient(90deg, ${C.purple}, ${C.green})`,
              width: `${levelPct}%`,
              boxShadow: `0 0 14px ${C.purple}66`,
              transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
          {[
            { v: '8',    l: 'Badges'  },
            { v: '#127', l: 'Rank'    },
            { v: '14',   l: 'Matches' },
          ].map((s, i) => (
            <div key={i} style={{
              background: C.card, borderRadius: 12, padding: '12px 8px',
              textAlign: 'center', border: `1px solid ${C.border}`,
            }}>
              <div style={{
                fontSize: 20, fontWeight: 800, color: C.white,
                fontFamily: FONT.mono,
              }}>{s.v}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* XP Chart */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 18,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📈 Monthly XP Activity</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 72 }}>
          {monthlyXP.map((val, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', borderRadius: 4,
                height: `${(val / maxMonthly) * 64}px`,
                background: i === monthlyXP.length - 1
                  ? `linear-gradient(to top, ${C.green}, ${C.purple})`
                  : `${C.green}55`,
                boxShadow: i === monthlyXP.length - 1 ? `0 0 10px ${C.green}66` : 'none',
                transition: 'height 1s ease',
              }} />
              <div style={{ fontSize: 9, color: C.muted }}>{monthLabels[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 18,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏆 Wahdat NEOM Leaderboard</div>
        {leaderboard.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 12px',
            background: p.highlight ? `${C.green}18` : 'transparent',
            border: p.highlight ? `1px solid ${C.green}44` : '1px solid transparent',
            borderRadius: 12, marginBottom: 6,
            transition: 'all 0.2s',
          }}>
            <div style={{
              width: 28, textAlign: 'center',
              fontSize: 14, fontWeight: 700,
              color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : C.green,
              fontFamily: FONT.mono,
            }}>#{p.rank}</div>
            <div style={{ fontSize: 18 }}>{p.badge}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: p.highlight ? 700 : 500,
                color: p.highlight ? C.green : C.white,
              }}>{p.name}</div>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: p.highlight ? C.green : C.muted,
              fontFamily: FONT.mono,
            }}>
              {p.xp.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Data Governance */}
      <div style={{
        background: `${C.green}0A`, border: `1px solid ${C.green}33`,
        borderRadius: 18, padding: 18,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🔐 Data Sovereignty</div>
        {[
          'NEOM Club retains 100% ownership of your fan data',
          'FanHour acts strictly as processor · Saudi PDPL compliant',
          'Full data portability · Export or delete anytime',
          'No data sold to third parties · Ever',
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, marginBottom: 7,
            fontSize: 12, color: C.muted,
          }}>
            <span style={{ color: C.green, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
