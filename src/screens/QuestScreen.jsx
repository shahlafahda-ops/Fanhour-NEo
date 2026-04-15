import { useState } from 'react';
import { C, FONT } from '../brand.js';
import { SonicBg, XPBar, Badge, Pill } from '../components/UI.jsx';

function QuestItem({ title, xp, done, icon, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: done ? `${C.green}11` : C.card,
        border: `1px solid ${done ? C.green + '44' : C.border}`,
        borderRadius: 14, padding: '14px 16px',
        cursor: done ? 'default' : 'pointer',
        transition: 'all 0.2s',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {done && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, ${C.green}08, transparent)`,
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: done ? C.greenDim : C.card2,
        border: `1px solid ${done ? C.green + '66' : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
        transition: 'all 0.3s',
      }}>
        {done ? '✓' : icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: done ? C.muted : C.white,
          textDecoration: done ? 'line-through' : 'none',
        }}>{title}</div>
        {!done && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Tap to complete</div>
        )}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: done ? C.muted : C.green,
        fontFamily: FONT.mono, flexShrink: 0,
      }}>+{xp} XP</div>
    </div>
  );
}

export default function QuestScreen({ xp, addXp }) {
  const [quests, setQuests] = useState([
    { id: 1, title: "Read today's match preview",    xp: 10,  done: true,  icon: '📰' },
    { id: 2, title: 'Vote in the lineup poll',       xp: 15,  done: false, icon: '📊' },
    { id: 3, title: 'Make a match prediction',       xp: 25,  done: false, icon: '🔮' },
    { id: 4, title: 'Attend a NEOM home match',      xp: 100, done: false, icon: '🏟' },
    { id: 5, title: 'Invite a friend to FanHour',    xp: 75,  done: false, icon: '👥' },
    { id: 6, title: 'Early check-in at King Khalid', xp: 50,  done: false, icon: '📍' },
    { id: 7, title: 'Share AR Fan Cam moment',       xp: 30,  done: false, icon: '📷' },
    { id: 8, title: 'Complete Wahdat NEOM profile',  xp: 20,  done: false, icon: '✏️' },
  ]);

  const complete = (id) => {
    const q = quests.find(q => q.id === id);
    if (!q || q.done) return;
    setQuests(prev => prev.map(q => q.id === id ? { ...q, done: true } : q));
    addXp(q.xp);
  };

  const earned = quests.filter(q => q.done).reduce((a, q) => a + q.xp, 0);
  const total  = quests.reduce((a, q) => a + q.xp, 0);
  const pct    = Math.round((earned / total) * 100);

  const badges = [
    { icon: '🔥', label: 'First Quest',  earned: true  },
    { icon: '⚽', label: 'Match Day',    earned: true  },
    { icon: '📊', label: 'Poll King',    earned: true  },
    { icon: '🏆', label: 'Top 100',      earned: true  },
    { icon: '🌟', label: 'VIP Fan',      earned: true  },
    { icon: '👥', label: 'Recruiter',    earned: false },
    { icon: '🎯', label: 'Predictor',    earned: false },
    { icon: '📍', label: 'Early Bird',   earned: false },
    { icon: '💎', label: 'Diamond Fan',  earned: false },
    { icon: '🚀', label: 'Legend',       earned: false },
  ];

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="50%" y="30%" color={C.green} opacity={0.1} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 4 }}>GAMIFICATION LOOP</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          Fan <span style={{ color: C.green }}>Quests</span>
        </div>
      </div>

      {/* XP Ring + Summary */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green}22, ${C.purple}11)`,
        border: `1px solid ${C.green}44`, borderRadius: 18,
        padding: 18, marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        {/* Ring */}
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke={C.border} strokeWidth="7" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke={C.green} strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1.5s ease', filter: `drop-shadow(0 0 4px ${C.green})` }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: C.green, fontFamily: FONT.mono,
          }}>{pct}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>TODAY'S QUEST POOL</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.green, fontFamily: FONT.mono }}>
            {earned} <span style={{ fontSize: 15, color: C.muted }}>/ {total} XP</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {quests.filter(q => q.done).length}/{quests.length} quests complete
          </div>
        </div>
      </div>

      {/* Daily Quests */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 10 }}>
          DAILY CHALLENGES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quests.slice(0, 5).map(q => (
            <QuestItem key={q.id} {...q} onClick={() => complete(q.id)} />
          ))}
        </div>
      </div>

      {/* Bonus Quests */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 10 }}>
          BONUS MISSIONS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quests.slice(5).map(q => (
            <QuestItem key={q.id} {...q} onClick={() => complete(q.id)} />
          ))}
        </div>
      </div>

      {/* Badges */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Achievement Badges</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {badges.map((b, i) => (
            <Badge key={i} {...b} delay={b.earned ? i * 0.08 : 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
