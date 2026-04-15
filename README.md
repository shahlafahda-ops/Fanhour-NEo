# FanHour × NEOM Club App

The official digital fan engagement platform for NEOM FC — Saudi Pro League 2025/26.

## Stack
- **React 18** + **Vite 5** (zero-config, fast HMR)
- Zero external UI libraries — pure custom components
- Fully responsive (mobile-first, desktop centered)
- FanHour brand guidelines: Riyadh Emerald #00E676, Cyber Amethyst #6515EE

## Quick Start (Local Dev)

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Build for Production

```bash
npm run build
# Output: /dist folder (static files ready to deploy)
```

## Deploy Options

### Option 1: Vercel (Recommended — 30 seconds)
1. Push to GitHub
2. Go to https://vercel.com/new
3. Import your repo → Click Deploy
4. Done. Auto-deploys on every push.

### Option 2: Netlify (Drag & Drop — 60 seconds)
1. Run `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag the `/dist` folder into the browser
4. Done. Live URL instantly.

### Option 3: GitHub Pages
```bash
npm install --save-dev gh-pages
# Add to package.json scripts: "deploy": "gh-pages -d dist"
npm run build && npm run deploy
```

### Option 4: Any Static Host (S3, Azure Static, Firebase, etc.)
Run `npm run build`, upload the `/dist` folder.

## App Features

| Screen    | Features |
|-----------|----------|
| 🏠 Hub     | Live countdown, KPI stats, season progress, Vision 2030 targets |
| ⚡ Quest   | 8 daily quests with XP rewards, achievement badges, SVG progress ring |
| 🏟 Matchday | Live score, check-in, AR Fan Cam, Halftime Treasure Hunt, live poll |
| 🏪 Market  | SME marketplace, tier filtering, G-Formula revenue split |
| 👤 Profile | Level progression, monthly XP chart, Wahdat NEOM leaderboard |

## Key KPIs (From Strategy Docs)
- +32% Match Attendance (stadium check-in bonuses)
- +45% Merchandise Sales (points-to-purchase conversion)
- 23% Fan Data Capture Rate (in-stadium activations)
- SAR 275K–825K Year 1 SME Marketplace Revenue (NEOM Club 55% share)

## Environment Variables (Future)
```
VITE_API_URL=https://api.fanhour.com
VITE_CLUB_ID=neom-fc
```
