import { useState, useCallback } from 'react';
import { C, FONT } from './brand.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { Logo, XPToast } from './components/UI.jsx';
import Onboarding      from './screens/Onboarding.jsx';
import HomeScreen      from './screens/HomeScreen.jsx';
import QuestScreen     from './screens/QuestScreen.jsx';
import MatchdayScreen  from './screens/MatchdayScreen.jsx';
import MarketScreen    from './screens/MarketScreen.jsx';
import ProfileScreen   from './screens/ProfileScreen.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import StoreScreen     from './screens/StoreScreen.jsx';

const TABS = [
  { id: 'home',      label: 'Hub',       emoji: '⬡'  },
  { id: 'quest',     label: 'Quest',     emoji: '⚡'  },
  { id: 'matchday',  label: 'Matchday',  emoji: '🏟'  },
  { id: 'market',    label: 'Market',    emoji: '🏪'  },
  { id: 'store',     label: 'Store',     emoji: '🛍'  },
  { id: 'dashboard', label: 'Stats',     emoji: '📊'  },
  { id: 'profile',   label: 'Profile',   emoji: '👤'  },
];

function BottomNav({ active, setActive }) {
  return (
    <nav style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: `${C.card}F4`,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderTop: `1px solid ${C.border}`,
      display: 'flex', padding: '6px 2px 14px',
      zIndex: 100,
    }}>
      {TABS.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: on ? C.green : C.muted, transition: 'color 0.2s', padding: '3px 0',
          }}>
            <div style={{
              lineHeight: 1, fontSize: t.id === 'home' ? 0 : 17,
              filter: on ? `drop-shadow(0 0 5px ${C.green})` : 'none',
              transition: 'filter 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24,
            }}>
              {t.id === 'home' ? <Logo size={21} /> : t.emoji}
            </div>
            <div style={{ fontSize: 9, fontWeight: on ? 700 : 400, letterSpacing: 0.2, fontFamily: FONT.main }}>{t.label}</div>
            <div style={{
              width: on ? 18 : 0, height: 2, borderRadius: 1, background: C.green,
              boxShadow: on ? `0 0 5px ${C.green}` : 'none',
              transition: 'width 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [xp,        setXp]       = useLocalStorage('fh-xp',        3240);
  const [onboarded, setOnboarded] = useLocalStorage('fh-onboarded', false);
  const [tab,       setTab]       = useState('home');
  const [toast,     setToast]     = useState({ visible: false, amount: 0 });

  const addXp = useCallback((amount) => {
    setXp(prev => Math.max(0, prev + amount));
    if (amount > 0) {
      setToast({ visible: true, amount });
      setTimeout(() => setToast({ visible: false, amount: 0 }), 1800);
    }
  }, [setXp]);

  const screens = {
    home:      <HomeScreen      xp={xp}               />,
    quest:     <QuestScreen     xp={xp} addXp={addXp} />,
    matchday:  <MatchdayScreen          addXp={addXp} />,
    market:    <MarketScreen                           />,
    store:     <StoreScreen     xp={xp} addXp={addXp} />,
    dashboard: <DashboardScreen                        />,
    profile:   <ProfileScreen   xp={xp}               />,
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;

  return (
    <div style={{ width: '100vw', height: '100vh', background: C.black, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <XPToast amount={toast.amount} visible={toast.visible} />
      <div style={{
        width: '100%', maxWidth: isMobile ? '100%' : 430,
        height: '100%', maxHeight: isMobile ? '100%' : 900,
        background: C.black, position: 'relative', overflow: 'hidden',
        borderRadius: isMobile ? 0 : 44,
        boxShadow: isMobile ? 'none' : `0 0 80px ${C.purple}33, 0 0 160px ${C.green}0A`,
      }}>
        {!onboarded && <Onboarding onComplete={() => setOnboarded(true)} />}

        {/* Status Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px 8px', fontSize: 12, color: C.muted, fontWeight: 600,
          fontFamily: FONT.mono, borderBottom: `1px solid ${C.border}`,
          background: `${C.card}D0`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 50, position: 'relative', flexShrink: 0,
        }}>
          <span>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Logo size={20} />
            <span style={{ color: C.green, fontWeight: 800, fontFamily: FONT.main }}>FanHour</span>
            <span style={{ color: C.border }}>×</span>
            <span style={{ fontWeight: 700, fontFamily: FONT.main }}>NEOM</span>
          </div>
          <span style={{ color: C.green, fontFamily: FONT.mono }}>{xp.toLocaleString()} XP</span>
        </div>

        {/* Screen */}
        <div key={tab} className="screen-enter" style={{
          position: 'absolute', top: 45, bottom: 80, left: 0, right: 0,
          overflowY: 'auto', overflowX: 'hidden', paddingTop: 20, paddingBottom: 20,
        }}>
          {screens[tab]}
        </div>

        <BottomNav active={tab} setActive={setTab} />
      </div>
    </div>
  );
}
