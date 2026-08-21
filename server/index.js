import express from 'express';
import path from 'node:path';
import { sweepChallengeStates } from './lib/challenge.js';
import fanRoutes from './routes/fan.js';
import merchantRoutes from './routes/merchant.js';
import adminRoutes from './routes/admin.js';
import boardRoutes from './routes/board.js';

const app = express();
app.use(express.json({ limit: '64kb' }));

// Minimal hardening. HTTPS termination and real headers belong at the edge.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Frame-Options', 'DENY');
  next();
});

/* Coarse per-IP rate limit. Not a substitute for an edge WAF, but it keeps a
 * single client from hammering OTP or claim endpoints. */
const hits = new Map();
const RATE_LIMIT_PER_MIN = Number(process.env.FH_RATE_LIMIT ?? 120);
app.use('/api', (req, res, next) => {
  if (RATE_LIMIT_PER_MIN === 0) return next();
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const win = hits.get(ip)?.filter((t) => now - t < 60_000) || [];
  win.push(now);
  hits.set(ip, win);
  if (win.length > RATE_LIMIT_PER_MIN) return res.status(429).json({ error: 'RATE_LIMITED' });
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.use('/api', fanRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/board', boardRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

// Never leak a stack trace to a fan's browser.
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'INTERNAL', message_ar: 'حدث خطأ. حاول مرة أخرى.' });
});

// Serve the built SPA in production.
const dist = path.join(process.cwd(), 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));

// Server clock drives challenge open/lock transitions.
// unref() so this timer never holds the process open by itself.
const sweeper = setInterval(() => {
  try { sweepChallengeStates(); } catch (e) { console.error(e); }
}, 30_000);
sweeper.unref();

const PORT = process.env.PORT || 8787;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`FanHour pilot API on :${PORT}`));
}

export default app;
