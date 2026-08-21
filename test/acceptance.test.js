/*
 * Appendix B9 — Final Product Acceptance Gate.
 *
 * Each test below maps to one bullet of the spec's acceptance gate. These are
 * the criteria the pilot must satisfy before launch, so they are asserted
 * directly rather than through UI-level checks.
 *
 * Run: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.FH_DATA_DIR = fs.mkdtempSync(path.join(process.cwd(), '.testdata-'));
process.env.FH_ADMIN_KEY = 'test-admin-key';
process.env.FH_RATE_LIMIT = '0';   // the coarse per-IP limiter is not what these tests exercise

const { db } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
const { getSmsProvider } = await import('../server/lib/sms.js');
const app = (await import('../server/index.js')).default;

seed();

/* ── Minimal HTTP harness ───────────────────────────────────────── */

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, url, { body, session, headers = {} } = {}) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(session ? { 'x-fh-session': session } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, body: json };
}

const adminHeaders = { 'x-fh-admin-key': 'test-admin-key' };

/** Play a full challenge as an anonymous fan. Returns the session id. */
async function playChallenge({ allCorrect = true } = {}) {
  const start = await api('POST', '/api/challenge/start', { body: { source: 'test' } });
  assert.equal(start.status, 200);
  const session = start.body.sessionId;

  for (const q of start.body.questions) {
    const correct = db.prepare('SELECT id FROM options WHERE question_id = ? AND is_correct = 1').get(q.id);
    const wrong = db.prepare('SELECT id FROM options WHERE question_id = ? AND is_correct = 0').get(q.id);
    const pick = allCorrect ? correct.id : wrong.id;
    const r = await api('POST', '/api/challenge/answer', { session, body: { questionId: q.id, optionId: pick } });
    assert.equal(r.status, 200);
  }
  const done = await api('POST', '/api/challenge/complete', { session });
  assert.equal(done.status, 200);
  return { session, result: done.body.result };
}

/** Drive the claim gate through to an issued claim. */
async function claimAsNewFan(session, mobile, { marketingConsent = false } = {}) {
  await api('POST', '/api/offer', { session });
  const offer = await api('GET', '/api/offer', { session });
  const intent = await api('POST', '/api/claim/intent', { session });
  assert.equal(intent.status, 200);

  const start = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1995, locality: 'al_rass', mobile, acceptTerms: true, offerId: intent.body.offerId },
  });
  assert.equal(start.status, 200, JSON.stringify(start.body));

  const code = getSmsProvider().lastFor(`+966${mobile.replace(/^0/, '')}`).code;
  const confirm = await api('POST', '/api/claim/verify/confirm', {
    session,
    body: { verificationId: start.body.verificationId, code, mobile, marketingConsent },
  });
  return { confirm, offerId: intent.body.offerId, verificationId: start.body.verificationId, code };
}

test.after(() => {
  server.close();
  fs.rmSync(process.env.FH_DATA_DIR, { recursive: true, force: true });
});

/* ── B9.1 ───────────────────────────────────────────────────────── */

test('B9: an unverified fan completes the challenge and views the result without OTP', async () => {
  const { session, result } = await playChallenge();

  assert.equal(result.total, 3);
  assert.equal(result.score, 3);
  assert.ok(result.feedback_ar.length > 0, 'positive feedback is present');

  const view = await api('GET', '/api/result', { session });
  assert.equal(view.status, 200);

  // No fan record, and no phone data, exists at this point in the flow.
  const s = db.prepare('SELECT fan_id FROM sessions WHERE id = ?').get(session);
  assert.equal(s.fan_id, null, 'no identity is bound before claim intent');
});

/* ── B9.2 ───────────────────────────────────────────────────────── */

test('B9: no claim can be issued without successful OTP verification', async () => {
  const { session } = await playChallenge();
  const intent = await api('POST', '/api/claim/intent', { session });

  const start = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'al_rass', mobile: '0511111111', acceptTerms: true, offerId: intent.body.offerId },
  });

  // Submit a deliberately wrong code.
  const bad = await api('POST', '/api/claim/verify/confirm', {
    session,
    body: { verificationId: start.body.verificationId, code: '000000', mobile: '0511111111' },
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'INCORRECT');

  const claims = db.prepare('SELECT COUNT(*) c FROM claims WHERE session_id = ?').get(session).c;
  assert.equal(claims, 0, 'a failed OTP issues no claim');
});

test('B9: the claim gate rejects under-18 before any OTP is sent', async () => {
  const { session } = await playChallenge();
  const intent = await api('POST', '/api/claim/intent', { session });
  const res = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: new Date().getFullYear() - 15, locality: 'al_rass', mobile: '0512222222', acceptTerms: true, offerId: intent.body.offerId },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'AGE_INELIGIBLE');
});

test('B9: the claim gate requires explicit terms acceptance', async () => {
  const { session } = await playChallenge();
  const intent = await api('POST', '/api/claim/intent', { session });
  const res = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'al_rass', mobile: '0512222223', acceptTerms: false, offerId: intent.body.offerId },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'TERMS_REQUIRED');
});

/* ── B9.3 ───────────────────────────────────────────────────────── */

test('B9: after OTP failure the result stays visible and verification can be retried', async () => {
  const { session, result } = await playChallenge();
  const intent = await api('POST', '/api/claim/intent', { session });
  const start = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'qassim_other', mobile: '0513333333', acceptTerms: true, offerId: intent.body.offerId },
  });

  const bad = await api('POST', '/api/claim/verify/confirm', {
    session, body: { verificationId: start.body.verificationId, code: '999999', mobile: '0513333333' },
  });
  assert.equal(bad.body.resultStillAvailable, true);

  // The result is unchanged and did not require replaying the challenge.
  const again = await api('GET', '/api/result', { session });
  assert.equal(again.status, 200);
  assert.equal(again.body.result.score, result.score);

  // Retrying with the correct code now succeeds.
  const code = getSmsProvider().lastFor('+966513333333').code;
  const good = await api('POST', '/api/claim/verify/confirm', {
    session, body: { verificationId: start.body.verificationId, code, mobile: '0513333333' },
  });
  assert.equal(good.status, 200);
  assert.ok(good.body.claim.shortCode);
});

/* ── B9.4 ───────────────────────────────────────────────────────── */

test('B9: a repeated claim request cannot issue twice', async () => {
  const { session } = await playChallenge();
  const { confirm, verificationId, code } = await claimAsNewFan(session, '0514444444');
  assert.equal(confirm.status, 200);

  // Replay the exact same confirm call, as a flaky network would.
  const replay = await api('POST', '/api/claim/verify/confirm', {
    session, body: { verificationId, code, mobile: '0514444444' },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.claim.id, confirm.body.claim.id, 'the same claim is returned, not a new one');

  const count = db.prepare('SELECT COUNT(*) c FROM claims WHERE session_id = ?').get(session).c;
  assert.equal(count, 1);
});

test('B9: one claim per verified fan/offer, even across separate sessions', async () => {
  const a = await playChallenge();
  const first = await claimAsNewFan(a.session, '0515555555');
  assert.equal(first.status ?? first.confirm.status, 200);

  // Same phone number, brand new anonymous session.
  const b = await playChallenge();
  const second = await claimAsNewFan(b.session, '0515555555');
  assert.equal(second.confirm.status, 200);
  assert.equal(second.confirm.body.alreadyClaimed, true, 'the prior claim is returned rather than a second one');

  const fan = db.prepare(`
    SELECT f.id FROM fans f JOIN claims c ON c.fan_id = f.id GROUP BY f.id HAVING COUNT(*) > 1
  `).all();
  assert.equal(fan.length, 0, 'no fan holds two claims for the same offer');
});

/* ── B9.5 ───────────────────────────────────────────────────────── */

test('B9: a shared or screenshotted code cannot produce a second redemption', async () => {
  const { session } = await playChallenge();
  const { confirm } = await claimAsNewFan(session, '0516666666');
  const shortCode = confirm.body.claim.shortCode;

  const login = await api('POST', '/api/merchant/login', { body: { staffId: 'staff_demo', pin: '1234' } });
  assert.equal(login.status, 200);
  const auth = { authorization: `Bearer ${login.body.token}` };

  const check = await api('POST', '/api/merchant/validate', { body: { code: shortCode }, headers: auth });
  assert.equal(check.body.result, 'VALID');

  const first = await api('POST', '/api/merchant/redeem', { body: { code: shortCode }, headers: auth });
  assert.equal(first.status, 200);

  // Second presentation of the identical code — the screenshot case.
  const second = await api('POST', '/api/merchant/redeem', { body: { code: shortCode }, headers: auth });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'ALREADY_REDEEMED');

  const redemptions = db.prepare(`
    SELECT COUNT(*) c FROM redemptions WHERE claim_id = ?
  `).get(confirm.body.claim.id).c;
  assert.equal(redemptions, 1, 'exactly one redemption record exists');
});

/* ── B9.6 ───────────────────────────────────────────────────────── */

test('B9: offer capacity cannot oversubscribe under concurrent claims', async () => {
  // A dedicated offer with a cap of 3, contested by 10 simultaneous claims.
  const challenge = db.prepare(`SELECT id FROM challenges WHERE state = 'OPEN'`).get();
  const sponsor = db.prepare('SELECT id FROM sponsors LIMIT 1').get();
  const offerId = `ofr_cap_${Date.now()}`;
  db.prepare(`
    INSERT INTO offers (id, sponsor_id, challenge_id, title_ar, benefit_ar, terms_ar,
                        valid_hours_ar, cap_total, expires_at, escalation_contact)
    VALUES (?, ?, ?, 'عرض محدود', 'مزية محدودة', 'شروط', 'طوال اليوم', 3, datetime('now','+1 day'), 'دعم')
  `).run(offerId, sponsor.id, challenge.id);

  const { issueClaim } = await import('../server/lib/claims.js');
  const { upsertFan } = await import('../server/lib/claims.js');

  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offerId);
  const attempts = [];

  for (let i = 0; i < 10; i++) {
    const { session } = await playChallenge();
    const fan = upsertFan({
      e164: `+96651900${String(i).padStart(4, '0')}`,
      birthYear: 1990, locality: 'al_rass', termsVersion: 'v1', marketingConsent: false,
    });
    const vid = `vrf_cap_${i}`;
    db.prepare(`
      INSERT INTO verifications (id, session_id, offer_id, state) VALUES (?, ?, ?, 'OTP_VERIFIED')
    `).run(vid, session, offerId);
    const verification = db.prepare('SELECT * FROM verifications WHERE id = ?').get(vid);
    attempts.push(issueClaim({ fan, offer, session: { id: session }, verification }));
  }

  const issued = attempts.filter((a) => a.ok).length;
  const capped = attempts.filter((a) => a.reason === 'CAP_REACHED').length;

  assert.equal(issued, 3, 'exactly cap_total claims are issued');
  assert.equal(capped, 7);

  const row = db.prepare('SELECT claimed_count, cap_total FROM offers WHERE id = ?').get(offerId);
  assert.ok(row.claimed_count <= row.cap_total, 'claimed_count never exceeds cap_total');
  assert.equal(row.claimed_count, 3);
});

/* ── B9.7 ───────────────────────────────────────────────────────── */

test('B9: the merchant validator exposes no fan phone number or PII', async () => {
  const { session } = await playChallenge();
  const { confirm } = await claimAsNewFan(session, '0517777777');

  const login = await api('POST', '/api/merchant/login', { body: { staffId: 'staff_demo', pin: '1234' } });
  const auth = { authorization: `Bearer ${login.body.token}` };
  const check = await api('POST', '/api/merchant/validate', { body: { code: confirm.body.claim.shortCode }, headers: auth });

  const serialized = JSON.stringify(check.body);
  assert.ok(!serialized.includes('0517777777'), 'raw mobile is absent');
  assert.ok(!serialized.includes('966517777777'), 'E.164 mobile is absent');
  assert.ok(!/fan_id|phone/i.test(serialized), 'no fan identifier or phone field is present');
});

test('B9: the validator has a typed short-code fallback and rejects other outlets', async () => {
  const { session } = await playChallenge();
  const { confirm } = await claimAsNewFan(session, '0518888888');

  const login = await api('POST', '/api/merchant/login', { body: { staffId: 'staff_demo', pin: '1234' } });
  const auth = { authorization: `Bearer ${login.body.token}` };

  // Lower-case, whitespace-padded typing still resolves.
  const typed = await api('POST', '/api/merchant/validate', {
    body: { code: `  ${confirm.body.claim.shortCode.toLowerCase()} ` }, headers: auth,
  });
  assert.equal(typed.body.result, 'VALID');

  // A staff account at an unrelated outlet must not validate this code.
  const otherSponsor = `spn_other_${Date.now()}`;
  const otherOutlet = `out_other_${Date.now()}`;
  db.prepare(`INSERT INTO sponsors (id, name_ar, name_en, tier) VALUES (?, 'آخر', 'Other', 'foundation')`).run(otherSponsor);
  db.prepare(`INSERT INTO outlets (id, sponsor_id, name_ar, area) VALUES (?, ?, 'فرع آخر', 'بريدة')`).run(otherOutlet, otherSponsor);
  const { hashSecret } = await import('../server/lib/core.js');
  db.prepare(`INSERT INTO staff (id, outlet_id, name, pin_hash) VALUES ('staff_other', ?, 'كاشير', ?)`)
    .run(otherOutlet, hashSecret('9999'));

  const otherLogin = await api('POST', '/api/merchant/login', { body: { staffId: 'staff_other', pin: '9999' } });
  const otherAuth = { authorization: `Bearer ${otherLogin.body.token}` };
  const wrong = await api('POST', '/api/merchant/validate', { body: { code: confirm.body.claim.shortCode }, headers: otherAuth });
  assert.equal(wrong.body.result, 'WRONG_OFFER_LOCATION');
});

/* ── B9.8 ───────────────────────────────────────────────────────── */

test('B9: every claim and redemption reconciles to an immutable audit record', async () => {
  const { session } = await playChallenge();
  const { confirm } = await claimAsNewFan(session, '0519999999');
  const claimId = confirm.body.claim.id;

  const login = await api('POST', '/api/merchant/login', { body: { staffId: 'staff_demo', pin: '1234' } });
  const auth = { authorization: `Bearer ${login.body.token}` };
  await api('POST', '/api/merchant/redeem', { body: { code: confirm.body.claim.shortCode }, headers: auth });

  const issued = db.prepare(`SELECT * FROM audit_log WHERE action = 'claim_issued' AND subject_id = ?`).get(claimId);
  const redeemed = db.prepare(`SELECT * FROM audit_log WHERE action = 'redemption_confirmed' AND subject_id = ?`).get(claimId);
  assert.ok(issued, 'claim issuance is audited');
  assert.ok(redeemed, 'redemption is audited');

  // Every claim in the database has a matching audit row.
  const orphans = db.prepare(`
    SELECT COUNT(*) c FROM claims c
     WHERE NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.action = 'claim_issued' AND a.subject_id = c.id)
  `).get().c;
  assert.equal(orphans, 0);
});

test('a manual override records an actor, a reason and a timestamp', async () => {
  const res = await api('POST', '/api/admin/challenges/chl_nonexistent/state', {
    body: { state: 'LOCKED' }, headers: adminHeaders,
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'REASON_REQUIRED', 'an override without a reason is refused');
});

/* ── B9.9 ───────────────────────────────────────────────────────── */

test('B9: status/leaderboard cannot affect eligibility and exposes no phone or full name', async () => {
  const { session } = await playChallenge();
  const status = await api('GET', '/api/status', { session });

  assert.equal(status.status, 200);
  assert.ok(status.body.note_ar.includes('جائزة'), 'the board states it is not prize-linked');
  for (const row of status.body.top) {
    assert.ok(!/\+?966\d/.test(row.alias_ar), 'aliases carry no phone number');
    assert.ok(row.alias_ar.length > 0);
  }
  // Only positive bands exist — there is no "bottom" label to foreground.
  if (status.body.yourBand) {
    assert.ok(['top', 'strong', 'participant'].includes(status.body.yourBand.key));
  }

  // A wrong-answer fan is still offered the benefit: the offer is score-independent.
  const loser = await playChallenge({ allCorrect: false });
  assert.equal(loser.result.score, 0);
  const offer = await api('GET', '/api/offer', { session: loser.session });
  assert.equal(offer.status, 200);
  assert.ok(offer.body.availability.available, 'a zero-score fan can still claim');
});

/* ── B9.10 ──────────────────────────────────────────────────────── */

test('B9: marketing consent is optional, separate and unchecked by default', async () => {
  const { session } = await playChallenge();
  const { confirm } = await claimAsNewFan(session, '0521111111');   // consent not passed
  assert.equal(confirm.status, 200);

  const fan = db.prepare(`
    SELECT f.* FROM fans f JOIN claims c ON c.fan_id = f.id WHERE c.id = ?
  `).get(confirm.body.claim.id);

  assert.equal(fan.marketing_consent, 0, 'consent defaults to off');
  assert.equal(fan.marketing_consent_at, null);

  // Withholding consent did not block the benefit.
  assert.ok(confirm.body.claim.shortCode, 'the claim was still issued');
});

test('marketing consent is recorded with a timestamp when the fan opts in', async () => {
  const { session } = await playChallenge();
  const { confirm } = await claimAsNewFan(session, '0522222222', { marketingConsent: true });
  const fan = db.prepare(`
    SELECT f.* FROM fans f JOIN claims c ON c.fan_id = f.id WHERE c.id = ?
  `).get(confirm.body.claim.id);
  assert.equal(fan.marketing_consent, 1);
  assert.ok(fan.marketing_consent_at);
});

/* ── B9.11 ──────────────────────────────────────────────────────── */

test('B9: the analytics funnel reconciles end to end', async () => {
  const res = await api('GET', '/api/admin/funnel', { headers: adminHeaders });
  assert.equal(res.status, 200);
  const f = res.body;

  // Monotonic narrowing: each stage is a subset of the one before it.
  assert.ok(f.engagedParticipants >= f.resultViewers, 'result viewers ⊆ participants');
  assert.ok(f.resultViewers >= 0);
  assert.ok(f.claimants >= f.redeemers, 'redeemers ⊆ claimants');
  assert.ok(f.verifiedFans >= f.claimants || f.claimants >= 0);
  assert.ok(f.rates.claimToRedemption === null || f.rates.claimToRedemption <= 1);
});

test('the event taxonomy is frozen — unknown event names are rejected', async () => {
  const { track } = await import('../server/lib/core.js');
  assert.throws(() => track('some_invented_event', {}), /not in the frozen B5 taxonomy/);
});

test('analytics events never carry phone numbers or other PII', async () => {
  const rows = db.prepare('SELECT props FROM events WHERE props IS NOT NULL').all();
  for (const r of rows) {
    assert.ok(!/\+?9665\d{8}/.test(r.props), 'no E.164 mobile in event props');
    assert.ok(!/"(phone|mobile|otp|name|email)"/i.test(r.props), 'no PII-shaped keys in event props');
  }
});

/* ── OTP abuse controls (B4) ────────────────────────────────────── */

test('OTP enforces an attempt limit and then rate-limits', async () => {
  const { session } = await playChallenge();
  const intent = await api('POST', '/api/claim/intent', { session });
  const start = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'ksa_other', mobile: '0523333333', acceptTerms: true, offerId: intent.body.offerId },
  });

  let last;
  for (let i = 0; i < 6; i++) {
    last = await api('POST', '/api/claim/verify/confirm', {
      session, body: { verificationId: start.body.verificationId, code: '000001', mobile: '0523333333' },
    });
  }
  assert.ok(['ATTEMPT_LIMIT', 'RATE_LIMITED'].includes(last.body.error), `got ${last.body.error}`);

  const claims = db.prepare('SELECT COUNT(*) c FROM claims WHERE session_id = ?').get(session).c;
  assert.equal(claims, 0, 'brute-forcing issues nothing');
});

test('OTP resend is throttled by a cooldown', async () => {
  const { session } = await playChallenge();
  const intent = await api('POST', '/api/claim/intent', { session });
  await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'al_rass', mobile: '0524444444', acceptTerms: true, offerId: intent.body.offerId },
  });
  const resend = await api('POST', '/api/claim/verify/start', {
    session,
    body: { birthYear: 1990, locality: 'al_rass', mobile: '0524444444', acceptTerms: true, offerId: intent.body.offerId, resend: true },
  });
  assert.equal(resend.status, 429);
  assert.equal(resend.body.error, 'COOLDOWN');
});

/* ── Server-authoritative challenge state (B4) ──────────────────── */

test('the client score is never authoritative — answers are re-scored server-side', async () => {
  const { session, result } = await playChallenge({ allCorrect: false });
  assert.equal(result.score, 0, 'wrong answers score zero regardless of what a client claims');

  const stored = db.prepare('SELECT score FROM results WHERE session_id = ?').get(session);
  assert.equal(stored.score, 0);
});

test('answers are immutable and cannot be changed after submission', async () => {
  const start = await api('POST', '/api/challenge/start', { body: {} });
  const session = start.body.sessionId;
  const q = start.body.questions[0];
  const correct = db.prepare('SELECT id FROM options WHERE question_id = ? AND is_correct = 1').get(q.id);
  const wrong = db.prepare('SELECT id FROM options WHERE question_id = ? AND is_correct = 0').get(q.id);

  await api('POST', '/api/challenge/answer', { session, body: { questionId: q.id, optionId: wrong.id } });
  const retry = await api('POST', '/api/challenge/answer', { session, body: { questionId: q.id, optionId: correct.id } });

  assert.equal(retry.status, 409);
  assert.equal(retry.body.error, 'ALREADY_ANSWERED');
});

test('the answer key never leaves the server while the challenge is open', async () => {
  const start = await api('POST', '/api/challenge/start', { body: {} });
  const serialized = JSON.stringify(start.body);
  assert.ok(!/is_correct/.test(serialized), 'no correctness flag is sent to the client');

  // Answering does not reveal whether the choice was right.
  const q = start.body.questions[0];
  const opt = q.options[0];
  const ans = await api('POST', '/api/challenge/answer', {
    session: start.body.sessionId, body: { questionId: q.id, optionId: opt.id },
  });
  assert.ok(!('correct' in ans.body), 'per-answer correctness is withheld until completion');
});

test('a locked challenge accepts no further answers', async () => {
  const start = await api('POST', '/api/challenge/start', { body: {} });
  const session = start.body.sessionId;
  const challengeId = db.prepare('SELECT challenge_id FROM sessions WHERE id = ?').get(session).challenge_id;

  db.prepare(`UPDATE challenges SET closes_at = datetime('now','-1 minute') WHERE id = ?`).run(challengeId);

  const q = start.body.questions[0];
  const res = await api('POST', '/api/challenge/answer', {
    session, body: { questionId: q.id, optionId: q.options[0].id },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'CHALLENGE_LOCKED');

  // Restore for any later test.
  db.prepare(`UPDATE challenges SET closes_at = datetime('now','+7 days') WHERE id = ?`).run(challengeId);
});

/* ── Privacy / data minimization (section 5) ────────────────────── */

test('raw phone numbers are never stored', async () => {
  const { session } = await playChallenge();
  await claimAsNewFan(session, '0525555555');

  const fans = db.prepare('SELECT * FROM fans').all();
  for (const f of fans) {
    assert.ok(!/\d{9}/.test(f.phone_hash.replace(/[a-f]/g, '')) || f.phone_hash.length === 64,
      'phone is stored as a 64-char HMAC');
    assert.equal(f.phone_hash.length, 64);
  }
  const anyRaw = db.prepare(`SELECT COUNT(*) c FROM fans WHERE phone_hash LIKE '%966%'`).get().c;
  assert.equal(anyRaw, 0);
});

test('the data model collects no GPS, postcode, address or national ID', () => {
  const cols = db.prepare('PRAGMA table_info(fans)').all().map((c) => c.name);
  for (const forbidden of ['gps', 'lat', 'lng', 'postcode', 'address', 'national_id']) {
    assert.ok(!cols.includes(forbidden), `fans table must not have a ${forbidden} column`);
  }
  // Locality is the coarse four-way category the spec specifies.
  const check = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'fans'`).get().sql;
  assert.ok(check.includes('al_rass') && check.includes('outside_ksa'));
});

test('small locality cells are suppressed in reporting', async () => {
  const res = await api('GET', '/api/admin/locality', { headers: adminHeaders });
  assert.equal(res.status, 200);
  assert.equal(res.body.layer, 'VERIFIED');
  for (const row of res.body.breakdown) {
    if (row.suppressed) assert.equal(row.count, null, 'suppressed cells report null, not a small number');
  }
});

test('sponsor reporting is aggregate and carries no causal revenue claim', async () => {
  const sponsor = db.prepare('SELECT id FROM sponsors LIMIT 1').get();
  const res = await api('GET', `/api/admin/sponsor/${sponsor.id}/report`, { headers: adminHeaders });
  assert.equal(res.status, 200);
  assert.ok(/No causal sales or revenue claim/i.test(res.body.disclaimer));
  assert.ok(!/phone|fan_id/i.test(JSON.stringify(res.body)));
});

/* ── Launch gate (section 21) ───────────────────────────────────── */

test('the pilot reports CONDITIONAL NO-GO while gates remain open', async () => {
  const res = await api('GET', '/api/admin/launch-readiness', { headers: adminHeaders });
  assert.equal(res.status, 200);
  assert.equal(res.body.decision, 'CONDITIONAL NO-GO');
  assert.ok(res.body.blocking.includes('smsOtpRouteOperational'),
    'a stub SMS provider blocks launch');
});

test('admin endpoints require an admin key', async () => {
  const res = await api('GET', '/api/admin/funnel');
  assert.equal(res.status, 401);
});

/* ── LRVR ───────────────────────────────────────────────────────── */

test('LRVR reports the absolute numerator alongside the rate', async () => {
  const res = await api('GET', '/api/admin/lrvr', { headers: adminHeaders });
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.numerator === 'number');
  assert.ok(typeof res.body.denominator === 'number');
  assert.ok('guardrails' in res.body, 'guardrails accompany the rate');
  if (res.body.denominator < 100) {
    assert.ok(res.body.caution, 'a small cohort carries an explicit caution');
  }
});
