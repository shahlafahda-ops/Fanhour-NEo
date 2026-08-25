import { useState } from 'react';
import { C, FONT } from '../brand.js';
import { SonicBg, Pill, LiveDot } from '../components/UI.jsx';

function Poll({ question, options, voted, onVote }) {
  const TOTALS = [58, 28, 14];
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 18, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.muted }}>⚡ Interactive Poll</div>
        <Pill label="+15 XP" color={C.purple} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{question}</div>
      {options.map((opt, i) => {
        const pct = TOTALS[i];
        const isWinner = voted && i === 0;
        return (
          <div
            key={i}
            onClick={() => !voted && onVote(i)}
            style={{
              position: 'relative',
              background: C.card2,
              border: `1px solid ${isWinner ? C.green + '66' : C.border}`,
              borderRadius: 10, padding: '12px 14px', marginBottom: 8,
              cursor: voted ? 'default' : 'pointer',
              overflow: 'hidden', transition: 'border-color 0.2s',
            }}
          >
            {voted && (
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: isWinner ? `${C.green}18` : `${C.white}08`,
                borderRadius: 10,
                transition: 'width 1s ease',
              }} />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{opt}</span>
              {voted && (
                <span style={{
                  fontSize: 13, color: isWinner ? C.green : C.muted,
                  fontFamily: FONT.mono, fontWeight: 700,
                }}>{pct}%</span>
              )}
            </div>
          </div>
        );
      })}
      {voted && (
        <div style={{
          fontSize: 12, color: C.green, marginTop: 4,
          textAlign: 'center', fontWeight: 600,
        }}>
          ✓ Vote recorded · +15 XP earned!
        </div>
      )}
    </div>
  );
}

export default function MatchdayScreen({ addXp }) {
  const [checkedIn,     setCheckedIn]     = useState(false);
  const [arActive,      setArActive]      = useState(false);
  const [treasureOpen,  setTreasureOpen]  = useState(false);
  const [treasureFound, setTreasureFound] = useState(false);
  const [voted,         setVoted]         = useState(false);
  const [treasureBoxes, setTreasureBoxes] = useState([null, null, null]);

  const handleCheckIn = () => { setCheckedIn(true); addXp(50); };
  const handleAR      = () => { setArActive(true); addXp(30); };

  const handleTreasureTap = (i) => {
    if (treasureBoxes[i] !== null) return;
    const prize  = i === 1;
    const result = prize ? '🏆' : '💨';
    setTreasureBoxes(prev => { const n = [...prev]; n[i] = result; return n; });
    if (prize) { setTreasureFound(true); addXp(40); }
  };

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="50%" y="35%" color={C.purple} opacity={0.12} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 4 }}>IN-STADIUM ACTIVATIONS</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            Match<span style={{ color: C.purple }}>day</span>
          </div>
        </div>
        <LiveDot />
      </div>

      {/* Live Score */}
      <div style={{
        background: `linear-gradient(135deg, #1A1A2E, ${C.card})`,
        border: `1px solid ${C.purple}44`,
        borderRadius: 20, padding: 18, marginBottom: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        <SonicBg x="50%" y="50%" color={C.purple} opacity={0.12} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Pill label="SPL 2025/26 · MD 14" color={C.purple} />
          <LiveDot />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>⚡</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>NEOM FC</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 40, fontWeight: 800, fontFamily: FONT.mono,
              color: C.white, letterSpacing: -2,
            }}>2–1</div>
            <div style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>64'</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>🏠</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Al-Qadsiah</div>
          </div>
        </div>
      </div>

      {/* Check-In */}
      <div style={{
        background: C.card,
        border: `1px solid ${checkedIn ? C.green + '66' : C.border}`,
        borderRadius: 18, padding: 16, marginBottom: 14,
        transition: 'border-color 0.3s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>📍 Early Arrival Check-In</div>
            <div style={{ fontSize: 12, color: C.muted }}>Arrive 45 min early · Geofenced XP</div>
          </div>
          <Pill label="+50 XP" color={C.green} />
        </div>
        {checkedIn ? (
          <div style={{
            background: C.greenDim, border: `1px solid ${C.green}44`,
            borderRadius: 10, padding: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>
              ✓ Checked in! XP awarded · Sponsor deal unlocked 🎁
            </div>
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            style={{
              width: '100%',
              background: `linear-gradient(90deg, ${C.green}33, ${C.green}11)`,
              border: `1px solid ${C.green}66`,
              color: C.green, fontWeight: 700, fontSize: 14,
              borderRadius: 10, padding: 12, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            🏟 Check In at King Khalid Stadium
          </button>
        )}
      </div>

      {/* AR Fan Cam */}
      <div style={{
        background: C.card,
        border: `1px solid ${arActive ? C.purple + '66' : C.border}`,
        borderRadius: 18, padding: 16, marginBottom: 14,
        transition: 'border-color 0.3s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>📷 AR Fan Cam</div>
            <div style={{ fontSize: 12, color: C.muted }}>NEOM face paint · Jumbotron integration</div>
          </div>
          <Pill label="+30 XP" color={C.purple} />
        </div>
        {arActive ? (
          <div style={{
            background: `${C.purple}22`, border: `1px solid ${C.purple}44`,
            borderRadius: 10, padding: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🎭</div>
            <div style={{ fontSize: 13, color: C.purple, fontWeight: 700 }}>
              AR Filter Active! Share to earn viral reach bonus!
            </div>
          </div>
        ) : (
          <button
            onClick={handleAR}
            style={{
              width: '100%',
              background: `linear-gradient(90deg, ${C.purple}33, ${C.purple}11)`,
              border: `1px solid ${C.purple}66`,
              color: C.purple, fontWeight: 700, fontSize: 14,
              borderRadius: 10, padding: 12, cursor: 'pointer',
            }}
          >
            🌟 Launch AR Fan Cam
          </button>
        )}
      </div>

      {/* Halftime Treasure Hunt */}
      <div style={{
        background: C.card,
        border: `1px solid ${treasureFound ? C.green + '66' : C.border}`,
        borderRadius: 18, padding: 16, marginBottom: 14,
        transition: 'border-color 0.3s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>🎯 Halftime AR Treasure Hunt</div>
            <div style={{ fontSize: 12, color: C.muted }}>Sponsor-backed Prize Drop · 21K+ coupons benchmarked</div>
          </div>
          <Pill label="+40 XP" color={C.green} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              onClick={() => handleTreasureTap(i)}
              style={{
                background: treasureBoxes[i] !== null
                  ? (treasureBoxes[i] === '🏆' ? C.greenDim : C.card2)
                  : C.card2,
                border: `1px solid ${
                  treasureBoxes[i] === '🏆'
                    ? C.green + '66'
                    : treasureBoxes[i] === '💨'
                    ? C.border
                    : C.border
                }`,
                borderRadius: 14, height: 64,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 26,
                cursor: treasureBoxes[i] === null ? 'pointer' : 'default',
                transition: 'all 0.25s',
              }}
            >
              {treasureBoxes[i] !== null ? treasureBoxes[i] : '❓'}
            </div>
          ))}
        </div>
        {treasureFound && (
          <div style={{
            background: C.greenDim, border: `1px solid ${C.green}44`,
            borderRadius: 10, padding: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>
              🎉 Prize found! Coupon: NEOM2025 · Valid tonight only
            </div>
          </div>
        )}
        {!treasureFound && treasureBoxes.every(b => b !== null) && (
          <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>
            No prize this time — try again next match! 😅
          </div>
        )}
      </div>

      {/* Live Poll */}
      <Poll
        question="👑 Man of the Match — Your Vote?"
        options={['Lacazette 🇫🇷', 'Benrahma 🇩🇿', 'Hegazi 🇪🇬']}
        voted={voted}
        onVote={() => { setVoted(true); addXp(15); }}
      />

      {/* 23% Data Capture KPI */}
      <div style={{
        background: `${C.purple}11`, border: `1px solid ${C.purple}22`,
        borderRadius: 14, padding: 14, marginTop: 14, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 28, fontWeight: 700, color: C.purple,
          fontFamily: FONT.mono,
        }}>23%</div>
        <div style={{ fontSize: 11, color: C.muted }}>Fan Data Capture Rate · This Match</div>
      </div>
    </div>
  );
}
