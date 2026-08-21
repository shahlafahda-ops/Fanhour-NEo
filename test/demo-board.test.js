/*
 * Tests for the demo-mode and value-board surfaces added for the pitch.
 *
 * These exist because both surfaces are new places data can leak: the board is
 * shown on a wall to an audience, and demo mode deliberately relaxes OTP
 * secrecy. Both need to be provably safe and provably impossible to ship on.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.FH_DATA_DIR = fs.mkdtempSync(path.join(process.cwd(), '.testdata-'));
process.env.FH_ADMIN_KEY = 'test-admin-key';
process.env.FH_BOARD_KEY = 'test-board-key';
process.env.FH_RATE_LIMIT = '0';
process.env.FH_DEMO = '1';
process.env.FH_ALLOWED_ORIGINS = 'https://preview.lovable.app, https://fanhour.example';

const { db } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
const { generateDemoTraffic } = await import('../server/demo-seed.js');
const app = (await import('../server/index.js')).default;

seed();
generateDemoTraffic();

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, url, { body, headers = {}, session } = {}) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(session ? { 'x-fh-session': session } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
}

const admin = { 'x-fh-admin-key': 'test-admin-key' };

test.after(() => {
  server.close();
  fs.rmSync(process.env.FH_DATA_DIR, { recursive: true, force: true });
});

/* ── Board access ───────────────────────────────────────────────── */

test('the board refuses to render without its key', async () => {
  const res = await api('GET', '/api/board');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'BOARD_KEY_REQUIRED');
});

test('the board rejects the admin key — the two are separate credentials', async () => {
  const res = await api('GET', '/api/board?k=test-admin-key');
  assert.equal(res.status, 401);
});

/* ── Board content ──────────────────────────────────────────────── */

test('the board exposes only aggregate figures — no fan is identifiable', async () => {
  const res = await api('GET', '/api/board?k=test-board-key');
  assert.equal(res.status, 200);

  const serialized = JSON.stringify(res.body);
  assert.ok(!/\+?9665\d{8}/.test(serialized), 'no mobile number appears');
  assert.ok(!/fan_\w+/.test(serialized), 'no fan id appears');
  assert.ok(!/clm_\w+/.test(serialized), 'no claim id appears');
  assert.ok(!/ses_\w+/.test(serialized), 'no session id appears');
  assert.ok(!/alias|phone|birth/i.test(serialized), 'no personal field names appear');

  // Everything returned is a count or a rate.
  for (const v of Object.values(res.body.engagement)) {
    assert.ok(v === null || typeof v === 'number');
  }
});

test('the board ticker carries event types and times only', async () => {
  const res = await api('GET', '/api/board?k=test-board-key');
  for (const e of res.body.recent) {
    assert.deepEqual(Object.keys(e).sort(), ['name', 'occurred_at']);
  }
});

test('board figures reconcile with the database', async () => {
  const res = await api('GET', '/api/board?k=test-board-key');
  const { engagement, value } = res.body;

  assert.equal(value.verifiedFans, db.prepare('SELECT COUNT(*) c FROM fans').get().c);
  assert.equal(value.claims, db.prepare('SELECT COUNT(*) c FROM claims').get().c);
  assert.equal(
    value.redemptions,
    db.prepare(`SELECT COUNT(*) c FROM redemptions WHERE status='CONFIRMED'`).get().c,
  );
  assert.equal(engagement.completions, db.prepare('SELECT COUNT(*) c FROM results').get().c);

  // The funnel narrows, as a real one must.
  assert.ok(engagement.starts >= engagement.completions);
  assert.ok(value.claims >= value.redemptions);
  assert.ok(
    value.qassimRelevant === value.byLocality.al_rass + value.byLocality.qassim_other,
    'the local figure is exactly Al Rass plus the rest of Qassim',
  );
});

/* ── Demo traffic integrity ─────────────────────────────────────── */

test('demo traffic is generated through the real code paths, not fabricated rows', () => {
  // Every result has real answer rows behind it and a server-computed score.
  const bad = db.prepare(`
    SELECT COUNT(*) c FROM results r
     WHERE (SELECT COUNT(*) FROM answers a WHERE a.session_id = r.session_id) <> 3
  `).get().c;
  assert.equal(bad, 0, 'every scored result has exactly three stored answers');

  // Every claim reconciles to an audit record, same as a live one.
  const orphans = db.prepare(`
    SELECT COUNT(*) c FROM claims c
     WHERE NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.action='claim_issued' AND a.subject_id = c.id)
  `).get().c;
  assert.equal(orphans, 0);

  // Redemptions never exceed claims, and caps hold.
  const offer = db.prepare('SELECT claimed_count, cap_total FROM offers LIMIT 1').get();
  assert.ok(offer.claimed_count <= offer.cap_total);
});

test('demo traffic refuses to run outside demo mode', async () => {
  const prev = process.env.FH_DEMO;
  process.env.FH_DEMO = '0';
  assert.throws(() => generateDemoTraffic(), /requires FH_DEMO=1/);
  process.env.FH_DEMO = prev;
});

/* ── Demo mode is impossible to ship on ─────────────────────────── */

test('demo mode fails the launch-readiness gate', async () => {
  const res = await api('GET', '/api/admin/launch-readiness', { headers: admin });
  assert.equal(res.body.decision, 'CONDITIONAL NO-GO');
  assert.ok(res.body.blocking.includes('demoModeOff'), 'demo mode is named as blocking');
  assert.match(res.body.technical.demoModeOff, /^FAIL/);
});

test('demo mode surfaces the OTP, and flags that it did', async () => {
  const start = await api('POST', '/api/challenge/start', { body: {} });
  const session = start.body.sessionId;
  for (const q of start.body.questions) {
    await api('POST', '/api/challenge/answer', {
      session, body: { questionId: q.id, optionId: q.options[0].id },
    });
  }
  await api('POST', '/api/challenge/complete', { session });
  const intent = await api('POST', '/api/claim/intent', { session });

  const res = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'al_rass', mobile: '0577000111', acceptTerms: true, offerId: intent.body.offerId },
  });

  assert.equal(res.body.demoMode, true, 'the response is explicitly flagged as demo');
  assert.match(String(res.body.demoOtp), /^\d{6}$/);
});

test('the demo reset clears fan activity but keeps configuration', async () => {
  const fixturesBefore = db.prepare('SELECT COUNT(*) c FROM fixtures').get().c;
  const offersBefore = db.prepare('SELECT COUNT(*) c FROM offers').get().c;

  const res = await api('POST', '/api/admin/demo/reset', { headers: admin });
  assert.equal(res.status, 200);

  assert.equal(db.prepare('SELECT COUNT(*) c FROM fans').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM claims').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM results').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM events').get().c, 0);

  // Configuration survives — a demo reset is not a data-deletion tool.
  assert.equal(db.prepare('SELECT COUNT(*) c FROM fixtures').get().c, fixturesBefore);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM offers').get().c, offersBefore);
  assert.equal(db.prepare('SELECT claimed_count FROM offers LIMIT 1').get().claimed_count, 0);
});

test('the demo reset is refused when demo mode is off', async () => {
  const prev = process.env.FH_DEMO;
  process.env.FH_DEMO = '0';
  const res = await api('POST', '/api/admin/demo/reset', { headers: admin });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'DEMO_MODE_OFF');
  process.env.FH_DEMO = prev;
});

/* ── CORS for a separately-hosted front end ─────────────────────── */

test('an allowlisted origin receives a CORS grant naming exactly that origin', async () => {
  const res = await fetch(`${base}/api/challenge/live`, {
    headers: { origin: 'https://preview.lovable.app' },
  });
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://preview.lovable.app');
  assert.equal(res.headers.get('vary'), 'Origin', 'caches must key on Origin');

  const allowed = res.headers.get('access-control-allow-headers') || '';
  for (const h of ['x-fh-session', 'idempotency-key', 'content-type']) {
    assert.ok(allowed.includes(h), `${h} must be permitted or the fan flow breaks`);
  }
});

test('a preflight from an allowlisted origin succeeds', async () => {
  const res = await fetch(`${base}/api/challenge/start`, {
    method: 'OPTIONS',
    headers: { origin: 'https://preview.lovable.app', 'access-control-request-method': 'POST' },
  });
  assert.equal(res.status, 204);
});

test('CORS is refused for an origin that is not on the allowlist', async () => {
  const res = await fetch(`${base}/api/challenge/live`, {
    headers: { origin: 'https://evil.example.com' },
  });
  assert.equal(res.headers.get('access-control-allow-origin'), null,
    'an unlisted origin gets no CORS grant');
});

test('a preflight from an unlisted origin is rejected outright', async () => {
  const res = await fetch(`${base}/api/challenge/start`, {
    method: 'OPTIONS',
    headers: { origin: 'https://evil.example.com', 'access-control-request-method': 'POST' },
  });
  assert.equal(res.status, 403);
});

test('CORS never returns a wildcard origin', async () => {
  const res = await fetch(`${base}/api/challenge/live`, {
    headers: { origin: 'https://anything.example.com' },
  });
  assert.notEqual(res.headers.get('access-control-allow-origin'), '*',
    'a wildcard would let any site drive the claim gate');
});

test('CORS never allows credentials — the session is a header, not a cookie', async () => {
  const res = await fetch(`${base}/api/challenge/live`);
  assert.equal(res.headers.get('access-control-allow-credentials'), null);
});
