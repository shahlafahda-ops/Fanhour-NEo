import { useState } from 'react';
import { C, FONT } from '../brand.js';
import { SonicBg, Pill } from '../components/UI.jsx';

const SMES = [
  { name: 'Tabuk Shawarma Palace', category: 'F&B',          moment: 'Goal Replay Sponsor',           price: 'SAR 5,000',  icon: '🌮', tier: 'Local Hero'   },
  { name: 'NEOM Tech Hub Café',    category: 'F&B',          moment: 'Halftime Stats Sponsor',         price: 'SAR 5,000',  icon: '☕', tier: 'Local Hero'   },
  { name: 'Desert Rose Hotel',     category: 'Hospitality',  moment: 'Man of the Match Award',        price: 'SAR 12,000', icon: '🏨', tier: 'City Partner' },
  { name: 'Al-Faisaliah Pharmacy', category: 'Health',       moment: 'Pre-Match Medical Check-In',    price: 'SAR 8,000',  icon: '💊', tier: 'City Partner' },
  { name: 'Tabuk AutoHub',         category: 'Automotive',   moment: 'Early Arrival Check-In Sponsor',price: 'SAR 25,000', icon: '🚗', tier: 'City Partner' },
  { name: 'NEOM Adventure Tours',  category: 'Tourism',      moment: 'Off-Season Digital Quest',      price: 'SAR 5,000',  icon: '🌄', tier: 'Local Hero'   },
];

function SMECard({ name, category, moment, price, icon, tier, onActivate, activated }) {
  const col = tier === 'City Partner' ? C.purple : C.green;
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${activated ? col + '66' : C.border}`,
      borderRadius: 18, padding: 16,
      transition: 'border-color 0.3s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: `${col}22`, border: `1px solid ${col}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>{icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{category}</div>
          </div>
        </div>
        <Pill label={tier} color={col} />
      </div>
      <div style={{
        fontSize: 12, color: C.muted, marginBottom: 12,
        padding: '8px 10px', background: C.card2, borderRadius: 8,
      }}>
        🎯 <span style={{ color: C.white }}>{moment}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: col, fontWeight: 700, fontFamily: FONT.mono }}>{price}</span>
        <button
          onClick={onActivate}
          style={{
            background: activated ? `${col}33` : `${col}22`,
            border: `1px solid ${col}66`,
            color: col, fontSize: 12, fontWeight: 700,
            padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {activated ? '✓ Active' : 'Activate'}
        </button>
      </div>
    </div>
  );
}

export default function MarketScreen() {
  const [filter,     setFilter]     = useState('All');
  const [activated,  setActivated]  = useState({});

  const activate = (name) => setActivated(p => ({ ...p, [name]: true }));

  const filtered = filter === 'All'
    ? SMES
    : SMES.filter(s => s.tier === filter);

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="50%" y="20%" color={C.green} opacity={0.08} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 4 }}>PILLAR 3</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          SME <span style={{ color: C.green }}>Marketplace</span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
          Moment-based sponsorships · Starts SAR 5,000
        </div>
      </div>

      {/* Paradigm Shift */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green}18, ${C.purple}0A)`,
        border: `1px solid ${C.green}44`,
        borderRadius: 18, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>TRADITIONAL</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FF6B6B' }}>SAR 500K+/yr</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Enterprise corps only</div>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.green, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>FANHOUR SME</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>SAR 5,000</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Per moment · All businesses</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill label="✓ Real-time ROI" color={C.green} />
          <Pill label="✓ 3.5x ROI Guarantee" color={C.green} />
          <Pill label="✓ Hyper-flexible" color={C.green} />
        </div>
      </div>

      {/* Revenue KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { v: 'SAR 275K', l: 'Conservative Yr 1', s: '50 SMEs · SAR 10K avg', c: C.green },
          { v: 'SAR 825K', l: 'Optimistic Yr 1',   s: '100 SMEs · SAR 15K avg', c: C.purple },
        ].map((item, i) => (
          <div key={i} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '14px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: item.c, fontFamily: FONT.mono }}>{item.v}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{item.l}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{item.s}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['All', 'Local Hero', 'City Partner'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? C.green : C.card,
              border: `1px solid ${filter === f ? C.green : C.border}`,
              color: filter === f ? C.black : C.muted,
              fontSize: 12, fontWeight: 700,
              padding: '7px 14px', borderRadius: 999,
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: FONT.main,
            }}
          >{f}</button>
        ))}
      </div>

      {/* SME Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {filtered.map((sme, i) => (
          <SMECard
            key={i} {...sme}
            activated={!!activated[sme.name]}
            onActivate={() => activate(sme.name)}
          />
        ))}
      </div>

      {/* G-Formula */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: 18,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⚙ G-Formula Revenue Split</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { pct: '55%', label: 'NEOM Club',    sub: 'Direct share', color: C.green  },
            { pct: '35%', label: 'FanHour Ops',  sub: 'Platform',     color: C.purple },
            { pct: '10%', label: 'Sports Fund',  sub: 'Grassroots',   color: '#FF9800' },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1,
              background: `${item.color}18`,
              border: `1px solid ${item.color}44`,
              borderRadius: 12, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{
                fontSize: 20, fontWeight: 800, color: item.color,
                fontFamily: FONT.mono,
              }}>{item.pct}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.white, marginTop: 3 }}>{item.label}</div>
              <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 14, fontSize: 12, color: C.green,
          textAlign: 'center', fontWeight: 700,
        }}>
          ZERO upfront cost · Revenue begins Month 1
        </div>
      </div>
    </div>
  );
}
