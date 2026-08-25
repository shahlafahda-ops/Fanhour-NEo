import { useState } from 'react';
import { C, FONT } from '../brand.js';
import { SonicBg, Pill } from '../components/UI.jsx';

const PRODUCTS = [
  {
    id: 1, name: 'NEOM FC Home Kit 2025/26', price: 320, xpPrice: 4000,
    category: 'Kit', badge: '🏆 Official', icon: '👕',
    color: C.green, stock: 47, rating: 4.8,
  },
  {
    id: 2, name: 'Lacazette Signed Print', price: 850, xpPrice: 12000,
    category: 'Collectible', badge: '⭐ Limited', icon: '🖼',
    color: C.purple, stock: 8, rating: 4.9,
  },
  {
    id: 3, name: 'NEOM × FanHour Cap', price: 120, xpPrice: 1500,
    category: 'Apparel', badge: null, icon: '🧢',
    color: C.green, stock: 200, rating: 4.6,
  },
  {
    id: 4, name: 'Wahdat NEOM Scarf', price: 95, xpPrice: 1200,
    category: 'Apparel', badge: null, icon: '🧣',
    color: '#00BCD4', stock: 150, rating: 4.7,
  },
  {
    id: 5, name: 'Digital Fan Pass — Gold', price: 450, xpPrice: 6000,
    category: 'Digital', badge: '💎 Premium', icon: '🎫',
    color: '#FFD700', stock: null, rating: 5.0,
  },
  {
    id: 6, name: 'AR Badge Collection (Season 1)', price: 75, xpPrice: 800,
    category: 'Digital', badge: '🆕 New', icon: '🏅',
    color: C.purple, stock: null, rating: 4.5,
  },
];

function ProductCard({ product, userXp, onBuyXp, inCart }) {
  const canAffordXp = userXp >= product.xpPrice;
  return (
    <div style={{
      background: C.card, border: `1px solid ${inCart ? product.color + '66' : C.border}`,
      borderRadius: 18, padding: 16, transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, flexShrink: 0,
          background: `${product.color}22`, border: `1px solid ${product.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>{product.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, lineHeight: 1.3 }}>{product.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill label={product.category} color={product.color} small />
            {product.badge && <Pill label={product.badge} color={product.color} small />}
          </div>
        </div>
      </div>

      {product.stock !== null && (
        <div style={{ fontSize: 11, color: product.stock < 20 ? '#FF9800' : C.muted, marginBottom: 10 }}>
          {product.stock < 20 ? `⚠ Only ${product.stock} left` : `${product.stock} in stock`}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: product.color, fontFamily: FONT.mono }}>
            SAR {product.price}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
            or{' '}
            <span style={{ color: canAffordXp ? C.green : C.muted, fontWeight: 700, fontFamily: FONT.mono }}>
              {product.xpPrice.toLocaleString()} XP
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onBuyXp(product)}
            disabled={!canAffordXp}
            style={{
              background: canAffordXp ? `${C.green}22` : C.card2,
              border: `1px solid ${canAffordXp ? C.green + '66' : C.border}`,
              color: canAffordXp ? C.green : C.muted,
              fontSize: 11, fontWeight: 700,
              padding: '7px 12px', borderRadius: 8,
              cursor: canAffordXp ? 'pointer' : 'not-allowed',
              fontFamily: FONT.main,
              transition: 'all 0.2s',
            }}
          >
            {inCart ? '✓ Added' : 'Use XP'}
          </button>
          <button style={{
            background: `${product.color}22`,
            border: `1px solid ${product.color}66`,
            color: product.color, fontSize: 11, fontWeight: 700,
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            fontFamily: FONT.main, transition: 'all 0.2s',
          }}>
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreScreen({ xp, addXp }) {
  const [cart,   setCart]   = useState({});
  const [filter, setFilter] = useState('All');

  const buyWithXp = (product) => {
    if (xp < product.xpPrice || cart[product.id]) return;
    addXp(-product.xpPrice);
    setCart(p => ({ ...p, [product.id]: true }));
  };

  const categories = ['All', 'Kit', 'Apparel', 'Collectible', 'Digital'];
  const filtered = filter === 'All'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === filter);

  const cartCount = Object.keys(cart).length;

  return (
    <div className="screen-enter" style={{ padding: '0 20px 20px', position: 'relative' }}>
      <SonicBg x="50%" y="20%" color={C.purple} opacity={0.1} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1.2, marginBottom: 4 }}>OFFICIAL STORE</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            NEOM <span style={{ color: C.green }}>Shop</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            background: `${C.green}18`, border: `1px solid ${C.green}44`,
            borderRadius: 10, padding: '6px 12px',
            fontSize: 12, fontWeight: 700, color: C.green, fontFamily: FONT.mono,
          }}>⚡ {xp.toLocaleString()} XP</div>
          {cartCount > 0 && (
            <div style={{
              background: `${C.purple}22`, border: `1px solid ${C.purple}44`,
              borderRadius: 10, padding: '6px 12px',
              fontSize: 12, fontWeight: 700, color: C.purple,
            }}>🛍 {cartCount}</div>
          )}
        </div>
      </div>

      {/* XP = Currency Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green}22, ${C.purple}11)`,
        border: `1px solid ${C.green}44`,
        borderRadius: 16, padding: 14, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ fontSize: 32 }}>⚡</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>
            Your XP is real money here
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Redeem quest points for official merchandise, digital collectibles, and fan passes.
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              background: filter === cat ? C.green : C.card,
              border: `1px solid ${filter === cat ? C.green : C.border}`,
              color: filter === cat ? C.black : C.muted,
              fontSize: 12, fontWeight: 700,
              padding: '7px 14px', borderRadius: 999,
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: FONT.main, transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >{cat}</button>
        ))}
      </div>

      {/* Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {filtered.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            userXp={xp}
            onBuyXp={buyWithXp}
            inCart={!!cart[product.id]}
          />
        ))}
      </div>

      {/* Points to purchase explainer */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 +45% Merchandise Sales</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
          FanHour's points-to-purchase conversion system drives a{' '}
          <span style={{ color: C.green, fontWeight: 700 }}>+45% uplift</span>{' '}
          in merchandise revenue by converting daily engagement into real purchasing intent.
          Every quest completed is a step closer to your next NEOM FC item.
        </div>
      </div>
    </div>
  );
}
