import { C, FONT } from '../brand.js';
import { Logo } from './UI.jsx';

const TABS = [
  { id: 'home',     icon: '⬡',  label: 'Hub'      },
  { id: 'quest',    icon: '⚡', label: 'Quest'    },
  { id: 'matchday', icon: '🏟', label: 'Matchday' },
  { id: 'market',   icon: '🏪', label: 'Market'   },
  { id: 'profile',  icon: '👤', label: 'Profile'  },
];

export default function BottomNav({ active, setActive }) {
  return (
    <nav style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: `${C.card}F2`,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: `1px solid ${C.border}`,
      display: 'flex',
      padding: '8px 4px 16px',
      zIndex: 100,
    }}>
      {TABS.map(t => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              color: on ? C.green : C.muted,
              animation: on ? 'tab-bounce 0.3s ease' : 'none',
              transition: 'color 0.2s',
              padding: '4px 0',
            }}
          >
            <div style={{
              fontSize: 20,
              filter: on ? `drop-shadow(0 0 6px ${C.green})` : 'none',
              transition: 'filter 0.2s',
              lineHeight: 1,
            }}>
              {t.id === 'home' ? <Logo size={22} /> : t.icon}
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: on ? 700 : 400,
              fontFamily: FONT.main,
              letterSpacing: 0.3,
            }}>
              {t.label}
            </div>
            <div style={{
              width: on ? 20 : 0,
              height: 2,
              borderRadius: 1,
              background: C.green,
              boxShadow: on ? `0 0 6px ${C.green}` : 'none',
              transition: 'width 0.25s ease',
            }} />
          </button>
        );
      })}
    </nav>
  );
}
