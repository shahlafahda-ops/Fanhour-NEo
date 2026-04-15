import { useState, useEffect } from 'react';
import { C, FONT } from '../brand.js';
import { SonicBg, Pill } from '../components/UI.jsx';

/* ─── Mini bar chart ─────────────────────────────────────────────── */
function BarChart({ data, labels, color = C.green, height = 80, unit = '' }) {
  const max = Math.max(...data);
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height }}>
        {data.map((val, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              fontSize: 9, color: C.muted, fontFamily: FONT.mono,
              opacity: i === data.length - 1 ? 1 : 0.6,
            }}>
              {i === data.length - 1 ? val + unit : ''}
            </div>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              height: `${(val / max) * (height - 20)}px`,
              background: i === data.length - 1
                ? `linear-gradient(to top, ${color}, ${color}BB)`
                : `${color}44`,
              boxShadow: i === data.length - 1 ? `0 0 8px ${color}66` : 'none',
              transition: 'height 1s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {labels.map((l, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', fontSize: 9,
              color: i === labels.length - 1 ? color : C.muted,
              fontWeight: i === labels.length - 1 ? 700 : 400,
            }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Donut chart ────────────────────────────────────────────────── */
function Donut({ segments, size = 90 }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  let offset = 0;
  const r = (size / 2) * 0.72;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={size * 0.12} />
        {segments.map((seg, i) => {
          const dash   = (seg.value / total) * circ;
          const gap    = circ - dash;
          const curOff = offset;
          offset += dash;
          return (
            <circle key={i}
              cx={size/2} cy={size/2} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={size * 0.12}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-curOff}
              strokeLinecap="butt"
              style={{ filter: `drop-shadow(0 0 3px ${seg.color}88)` }}
            />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.white, fontFamily: FONT.mono, lineHeight: 1 }}>
          {total.toLocaleString()}
        </div>
        <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>fans</div>
      </div>
    </div>
  );
}

/* ─── Heatmap row ────────────────────────────────────────────────── */
function HeatmapRow({ label, values }) {
  const max = Math.max(...values);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <div style={{ fontSize: 10, color: C.muted, width: 28, textAlign: 'right', flexShrink: 0 }}>{label}</div>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {values.map((v, i) => {
          const intensity = v / max;
          return (
            <div key={i} style={{
              flex: 1, height: 18, borderRadius: 3,
              background: intensity > 0.7
                ? C.green
                : intensity > 0.4
                ? `${C.green}88`
                : intensity > 0.1
                ? `${C.green}33`
                : C.card2,
              boxShadow: intensity > 0.7 ? `0 0 6px ${C.green}66` : 'none',
              transition: 'background 0.5s ease',
            }} />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Sentiment gauge ────────────────────────────────────────────── */
function SentimentGauge({ positive, neutral, negative }) {
  const total = positive + neutral + negative;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { label: 'Positive', val: positive, color: C.green },
          { label: 'Neutral',  val: neutral,  color: C.muted  },
          { label: 'Negative', val: negative, color: '#FF4444' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center',
            background: `${s.color}18`,
            border: `1px solid ${s.color}33`,
            borderRadius: 10, padding: '8px 4px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: FONT.mono }}>
              {Math.round((s.val / total) * 100)}%
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Bar */}
      <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 8 }}>
        {[
          { val: positive, color: C.green  },
          { val: neutral,  color: C.muted  },
          { val: negative, color: '#FF4444' },
        ].map((s, i) => (
          <div key={i} style={{
            width: `${(s.val / total) * 100}%`,
            height: '100%', background: s.color,
            transition: 'width 1s ease',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Live ticker ────────────────────────────────────────────────── */
function LiveTicker({ events }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % events.length), 3000);
    return () => clearInterval(t);
  }, [events.length]);
  const ev = events[idx];
  return (
    <div style={{
      background: `${ev.color}18`, border: `1px solid ${ev.color}33`,
      borderRadius: 10, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'background 0.5s ease',
    }}>
      <span style={{ fontSize: 18 }}>{ev.icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: ev.color }}>{ev.label}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{ev.detail}</div>
      </div>
      <div style={{
        marginLeft: 'auto', fontSize: 10, color: C.muted,
        fontFamily: FONT.mono,
      }}>{ev.time}</div>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────── */
export default function DashboardScreen() {
  const [liveCount, setLiveCount] = useState(3847);

  // Simulate live fan count ticking
  useEffect(() => {
    const t = setInterval(() => {
      setLiveCount(c => c + Math.floor(Math.random() * 3) - 1);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const ageData = [
    { label: '13–17', value: 1200, color: C.purple  },
    { label: '18–24', value: 3800, color: C.green   },
    { label: '25–34', value: 2900, color: '#00BCD4' },
    { label: '35–44', value: 1500, color: C.purple  },
    { label: '45+',   value:  600, color: C.muted   },
  ];

  const engagementHeatmap = [
    { label: 'Mon', values: [1,3,2,5,8,6,4,3,2,1,3,7] },
    { label: 'Tue', values: [2,2,1,4,9,7,5,4,3,2,4,6] },
    { label: 'Wed', values: [1,2,3,6,7,5,4,3,2,2,5,8] },
    { label: 'Thu', values: [3,4,2,5,8,9,7,6,4,3,5,7] },
    { label: 'Fri', values: [2,3,2,4,10,9,8,7,5,4,6,9] },
    { label: 'Sat', values: [4,5,3,6,10,10,9,8,6,5,7,10] },
    { label: 'Sun', values: [3,4,2,5,9,8,7,6,4,3,5,8]  },
  ];
  const hourLabels = ['6','8','10','12','14','16','18','20','21','22','23','24'];

  const liveEvents = [
    { icon: '⚡', label: '+127 XP earned', detail: 'Quest completions in last 5 min', color: C.green,  time: 'now'   },
    { icon: '📍', label: '89 check-ins',    detail: 'Early arrival at King Khalid',   color: C.purple, time: '4m ago' },
    { icon: '🏪', label: 'New SME signup',  detail: 'Tabuk AutoHub — City Partner',   color: C.green,  time: '7m ago' },
    { icon: '📊', label: '2,341 votes',     detail: 'Man of the Match poll live',      color: C.purple, time: '12m ago'},
  ];

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="80%" y="15%" color={C.green}  opacity={0.08} />
      <SonicBg x="20%" y="85%" color={C.purple} opacity={0.07} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 4 }}>CLUB MANAGEMENT</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            Command <span style={{ color: C.green }}>Dashboard</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${C.green}18`, border: `1px solid ${C.green}44`,
            borderRadius: 20, padding: '5px 12px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'live-dot 1s ease infinite' }} />
            <span style={{ fontSize: 12, color: C.green, fontWeight: 700, fontFamily: FONT.mono }}>
              {liveCount.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, color: C.muted }}>online</span>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { v: '12,847', l: 'Registered', c: C.green  },
          { v: '3,847',  l: 'Active Now',  c: C.purple },
          { v: '68%',    l: 'Retention',   c: C.green  },
        ].map((s, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '12px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: FONT.mono }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Live Ticker */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 8 }}>LIVE ACTIVITY</div>
        <LiveTicker events={liveEvents} />
      </div>

      {/* Demographics */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>👥 Fan Demographics</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Donut segments={ageData.map(a => ({ value: a.value, color: a.color }))} size={92} />
          <div style={{ flex: 1 }}>
            {ageData.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: C.muted, flex: 1 }}>{a.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: a.color, fontFamily: FONT.mono }}>
                  {Math.round((a.value / ageData.reduce((s, x) => s + x.value, 0)) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engagement Heatmap */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔥 Engagement Heatmap</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>App activity by hour · Last 7 days</div>

        {/* Hour labels */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 4, marginLeft: 34 }}>
          {hourLabels.map((h, i) => (
            <div key={i} style={{ flex: 1, fontSize: 8, color: C.muted, textAlign: 'center' }}>{h}</div>
          ))}
        </div>
        {engagementHeatmap.map((row, i) => (
          <HeatmapRow key={i} label={row.label} values={row.values} />
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <div style={{ fontSize: 9.5, color: C.muted }}>Low</div>
          {[0.1, 0.3, 0.5, 0.7, 1.0].map((v, i) => (
            <div key={i} style={{
              width: 14, height: 10, borderRadius: 2,
              background: v > 0.7 ? C.green : v > 0.4 ? `${C.green}88` : v > 0.1 ? `${C.green}33` : C.card2,
            }} />
          ))}
          <div style={{ fontSize: 9.5, color: C.muted }}>High</div>
        </div>
      </div>

      {/* Sentiment Analysis */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🧠 Sentiment Analysis</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>AI-driven · Wahdat NEOM community forums</div>
        <SentimentGauge positive={68} neutral={22} negative={10} />
        <div style={{
          marginTop: 12, background: C.card2, borderRadius: 10,
          padding: '10px 12px', fontSize: 12, color: C.muted, lineHeight: 1.6,
        }}>
          Top topics: <span style={{ color: C.green }}>Lacazette performance</span>,{' '}
          <span style={{ color: C.green }}>matchday experience</span>,{' '}
          <span style={{ color: '#FF9800' }}>ticket availability</span>
        </div>
      </div>

      {/* Attendance Prediction */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18, marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📈 Attendance Prediction</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Next 6 home matches · AI forecast</div>
        <BarChart
          data={[7200, 8100, 9400, 8800, 10200, 11800]}
          labels={['MD15', 'MD16', 'MD17', 'MD18', 'MD19', 'MD20']}
          color={C.purple}
          height={100}
          unit=""
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 10, fontSize: 11,
        }}>
          <span style={{ color: C.muted }}>Stadium capacity: 12,000</span>
          <span style={{ color: C.green, fontWeight: 700 }}>MD20: 98.3% sellout</span>
        </div>
      </div>

      {/* Revenue Tracker */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green}18, ${C.purple}0A)`,
        border: `1px solid ${C.green}44`,
        borderRadius: 18, padding: 18,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>💰 Season Revenue Tracker</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'SME Marketplace',     current: 187000, target: 275000, color: C.green  },
            { label: 'Digital Fan Passes',  current: 42000,  target: 80000,  color: C.purple },
            { label: 'Microtransactions',   current: 18500,  target: 40000,  color: '#00BCD4' },
          ].map((item, i) => {
            const pct = Math.round((item.current / item.target) * 100);
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                  <span style={{ color: C.white, fontWeight: 600 }}>{item.label}</span>
                  <span style={{ color: item.color, fontFamily: FONT.mono, fontWeight: 700 }}>
                    SAR {item.current.toLocaleString()} <span style={{ color: C.muted, fontSize: 10 }}>/ {(item.target/1000).toFixed(0)}K</span>
                  </span>
                </div>
                <div style={{ background: C.border, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: `linear-gradient(90deg, ${item.color}, ${item.color}CC)`,
                    borderRadius: 999,
                    boxShadow: `0 0 8px ${item.color}66`,
                    transition: 'width 1.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3, textAlign: 'right' }}>{pct}% of Year 1 target</div>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 14, textAlign: 'center', fontSize: 12,
          fontWeight: 700, color: C.green,
        }}>
          Total: SAR 247,500 · 66% of SAR 275K conservative target
        </div>
      </div>
    </div>
  );
}
