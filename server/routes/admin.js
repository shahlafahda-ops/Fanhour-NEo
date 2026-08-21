import express from 'express';
import { db } from '../db.js';
import { audit } from '../lib/core.js';
import { sweepChallengeStates } from '../lib/challenge.js';
import { isProductionSmsConfigured, getSmsProvider } from '../lib/sms.js';
import { QASSIM_RELEVANT } from '../lib/core.js';

const router = express.Router();

/*
 * Minimal internal admin. The spec forbids sponsor/club self-serve dashboards,
 * so this is FanHour-ops-only: challenge state, offer capacity, the frozen
 * funnel, and the launch-gate checklist. Sponsor reporting stays manual.
 */

function requireAdmin(req, res) {
  const key = req.get('x-fh-admin-key');
  const expected = process.env.FH_ADMIN_KEY || 'dev-admin-key';
  if (key !== expected) {
    res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
    return false;
  }
  return true;
}

router.use((req, res, next) => { if (requireAdmin(req, res)) next(); });

/* ── Funnel (B6 metric definitions) ─────────────────────────────── */

const uniq = (name, col = 'session_id') =>
  db.prepare(`SELECT COUNT(DISTINCT ${col}) c FROM events WHERE name = ? AND ${col} IS NOT NULL`).get(name).c;

router.get('/funnel', (req, res) => {
  const engagedParticipants = uniq('challenge_complete');
  const resultViewers       = uniq('result_view');
  const claimIntent         = uniq('claim_intent');
  const verificationStart   = uniq('verification_start');
  const otpVerified         = uniq('otp_verified');

  const claimants = db.prepare('SELECT COUNT(DISTINCT fan_id) c FROM claims').get().c;
  const redeemers = db.prepare(`
    SELECT COUNT(DISTINCT c.fan_id) c FROM redemptions r JOIN claims c ON c.id = r.claim_id
  `).get().c;

  const rate = (n, d) => (d > 0 ? Number((n / d).toFixed(4)) : null);

  res.json({
    // Never collapse these into one "activation" denominator (section 8).
    engagedParticipants,
    resultViewers,
    claimIntent,
    verifiedFans: otpVerified,
    claimants,
    redeemers,
    rates: {
      verificationCompletion: rate(otpVerified, verificationStart),
      resultToClaimIntent:    rate(claimIntent, resultViewers),
      claimToRedemption:      rate(redeemers, claimants),
    },
  });
});

/* ── LRVR: the primary operational fan-commercial KPI ───────────── */

/**
 * Local Repeat & Verified Redemption Rate.
 *
 * Numerator: unique verified Al Rass/Qassim-relevant fans who participated in
 * an eligible fixture, participated again in a LATER eligible fixture, and
 * completed at least one validated merchant redemption during the pilot.
 *
 * Denominator: unique verified Al Rass/Qassim-relevant fans from cohorts that
 * have had at least one subsequent eligible fixture opportunity.
 *
 * The absolute numerator is always returned alongside the rate, because a rate
 * over a tiny cohort is exactly the failure mode the guardrails exist to catch.
 */
router.get('/lrvr', (req, res) => {
  const localFans = db.prepare(`
    SELECT id FROM fans WHERE locality IN ('al_rass','qassim_other')
  `).all();

  const fixturesByTime = db.prepare('SELECT id, kickoff_at FROM fixtures ORDER BY kickoff_at ASC').all();
  const lastFixtureWithOpportunity = fixturesByTime.length > 1
    ? fixturesByTime[fixturesByTime.length - 1]
    : null;

  let denominator = 0;
  let numerator = 0;

  for (const fan of localFans) {
    const parts = db.prepare(`
      SELECT vr.fixture_id, f.kickoff_at FROM verified_results vr
        JOIN fixtures f ON f.id = vr.fixture_id
       WHERE vr.fan_id = ? ORDER BY f.kickoff_at ASC
    `).all(fan.id);

    if (parts.length === 0) continue;

    // Did a later eligible fixture exist after this fan's first participation?
    const first = parts[0];
    const hadLaterOpportunity = lastFixtureWithOpportunity &&
      new Date(lastFixtureWithOpportunity.kickoff_at) > new Date(first.kickoff_at);
    if (!hadLaterOpportunity) continue;

    denominator += 1;

    const returned = parts.length >= 2;
    const redeemed = db.prepare(`
      SELECT 1 FROM redemptions r JOIN claims c ON c.id = r.claim_id
       WHERE c.fan_id = ? AND r.status = 'CONFIRMED' LIMIT 1
    `).get(fan.id);

    if (returned && redeemed) numerator += 1;
  }

  res.json({
    numerator,
    denominator,
    rate: denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null,
    // Guardrails must be read with the rate, never instead of it.
    guardrails: {
      localActivatedFans: denominator,
      engagedParticipants: uniq('challenge_complete'),
      paidSponsors: db.prepare(`SELECT COUNT(*) c FROM sponsors WHERE paid = 1 AND arrangement = 'paid'`).get().c,
      nonPaidArrangements: db.prepare(`SELECT COUNT(*) c FROM sponsors WHERE arrangement != 'paid'`).get().c,
    },
    caution: denominator < 100
      ? 'Cohort below the Stage-4 evidence floor of 100 local activated fans — do not make feature decisions from this.'
      : null,
  });
});

/* ── Locality (B12: two clearly separated layers) ───────────────── */

router.get('/locality', (req, res) => {
  const verified = db.prepare(`
    SELECT locality, COUNT(*) c FROM fans GROUP BY locality
  `).all();

  const total = verified.reduce((a, r) => a + r.c, 0);
  const MIN_CELL = 10;   // suppression threshold, a Stage-4 privacy practice

  res.json({
    layer: 'VERIFIED',
    note: 'Verified locality among claim-gate verified fans only. This is NOT the locality of all challenge participants.',
    breakdown: verified.map((r) => ({
      locality: r.locality,
      count: r.c < MIN_CELL ? null : r.c,
      suppressed: r.c < MIN_CELL,
      qassimRelevant: QASSIM_RELEVANT.has(r.locality),
    })),
    totalVerified: total,
    engagedParticipants: uniq('challenge_complete'),
    verificationRate: total > 0 && uniq('challenge_complete') > 0
      ? Number((total / uniq('challenge_complete')).toFixed(4)) : null,
  });
});

/* ── Sponsor report inputs (manual, aggregated, no PII) ─────────── */

router.get('/sponsor/:id/report', (req, res) => {
  const sponsor = db.prepare('SELECT * FROM sponsors WHERE id = ?').get(req.params.id);
  if (!sponsor) return res.status(404).json({ error: 'NOT_FOUND' });

  const offers = db.prepare('SELECT * FROM offers WHERE sponsor_id = ?').all(sponsor.id);
  const claims = db.prepare(`
    SELECT COUNT(*) c FROM claims WHERE offer_id IN (SELECT id FROM offers WHERE sponsor_id = ?)
  `).get(sponsor.id).c;
  const redemptions = db.prepare(`
    SELECT COUNT(*) c FROM redemptions WHERE sponsor_id = ? AND status = 'CONFIRMED'
  `).get(sponsor.id).c;

  res.json({
    sponsor: { name_ar: sponsor.name_ar, tier: sponsor.tier, arrangement: sponsor.arrangement },
    offers: offers.map((o) => ({
      title_ar: o.title_ar, cap_total: o.cap_total, claimed: o.claimed_count, expires_at: o.expires_at,
    })),
    claims,
    validatedRedemptions: redemptions,
    // Section 16: verified engagement and validated redemption only.
    disclaimer: 'Verified engagement and validated redemption only. No causal sales or revenue claim is made or implied. No personal fan data is included.',
  });
});

/* ── Challenge state control ────────────────────────────────────── */

router.post('/challenges/sweep', (req, res) => {
  const out = sweepChallengeStates();
  audit({ actorType: 'admin', action: 'challenge_sweep', detail: out });
  res.json(out);
});

router.post('/challenges/:id/state', (req, res) => {
  const { state, reason } = req.body || {};
  const allowed = ['DRAFT', 'SCHEDULED', 'OPEN', 'LOCKED', 'SETTLED', 'ARCHIVED'];
  if (!allowed.includes(state)) return res.status(400).json({ error: 'INVALID_STATE' });
  if (!reason) return res.status(400).json({ error: 'REASON_REQUIRED' });

  db.prepare('UPDATE challenges SET state = ? WHERE id = ?').run(state, req.params.id);
  audit({
    actorType: 'admin', action: 'challenge_state_override',
    subjectType: 'challenge', subjectId: req.params.id, reason, detail: { state },
  });
  res.json({ ok: true });
});

/* ── Launch readiness (section 21 pre-launch hard gate) ─────────── */

/**
 * The pilot is CONDITIONAL NO-GO until every one of these is closed. Items that
 * are contractual, legal or commercial cannot be determined by this codebase —
 * they are reported as manual attestations that an operator must record.
 */
router.get('/launch-readiness', (req, res) => {
  const attested = (key) =>
    db.prepare(`SELECT 1 FROM audit_log WHERE action = 'gate_attested' AND subject_id = ? LIMIT 1`).get(key) ? 'ATTESTED' : 'OPEN';

  const technical = {
    demoModeOff: process.env.FH_DEMO === '1' ? 'FAIL — demo mode exposes the OTP in API responses' : 'PASS',
    smsOtpRouteOperational: isProductionSmsConfigured() ? 'PASS' : 'FAIL — stub SMS provider in use',
    merchantValidatorTested: db.prepare('SELECT COUNT(*) c FROM validation_attempts').get().c > 0 ? 'PASS' : 'OPEN',
    fixtureScheduleAttached: db.prepare('SELECT COUNT(*) c FROM fixtures WHERE opponent_confirmed = 1').get().c > 0 ? 'PARTIAL' : 'OPEN',
    offersHaveCaps: db.prepare('SELECT COUNT(*) c FROM offers WHERE cap_total IS NULL OR cap_total <= 0').get().c === 0 ? 'PASS' : 'FAIL',
  };

  const manual = {
    executedClubContract: attested('executed_club_contract'),
    commercialIncubationScheduleCorrect: attested('commercial_incubation_schedule'),
    rightsMatrixSigned: attested('rights_matrix'),
    clubDistributionCommitmentSigned: attested('club_distribution'),
    competitionLegalClassification: attested('competition_classification'),
    merchantBenefitLicensingResolved: attested('merchant_benefit_licensing'),
    privacyPolicyAndTermsFinal: attested('privacy_policy'),
    agePolicyLegallyReviewed: attested('age_policy'),
    processorsReviewedUnderPdpl: attested('pdpl_processors'),
    threePaidSponsorsSigned: db.prepare(`SELECT COUNT(*) c FROM sponsors WHERE arrangement = 'paid'`).get().c >= 3 ? 'PASS' : 'OPEN',
    incidentOwnerNamed: attested('incident_owner'),
  };

  const blocking = [
    ...Object.entries(technical).filter(([, v]) => !String(v).startsWith('PASS')),
    ...Object.entries(manual).filter(([, v]) => v !== 'PASS' && v !== 'ATTESTED'),
  ].map(([k]) => k);

  res.json({
    decision: blocking.length === 0 ? 'GO' : 'CONDITIONAL NO-GO',
    blocking,
    technical,
    manual,
    note: 'Public launch proceeds only after the agreement is executed/effective and every legal, rights, privacy, payment and Launch Readiness gate is closed.',
  });
});

router.post('/gates/:key/attest', (req, res) => {
  const { reason, actor } = req.body || {};
  if (!reason || !actor) return res.status(400).json({ error: 'ACTOR_AND_REASON_REQUIRED' });
  audit({
    actorType: 'admin', actorId: actor, action: 'gate_attested',
    subjectType: 'launch_gate', subjectId: req.params.key, reason,
  });
  res.json({ ok: true, gate: req.params.key });
});

/* ── Demo control ───────────────────────────────────────────────── */

/**
 * Wipe fan-side activity so a demo can be re-run from a clean board.
 *
 * Only available while FH_DEMO=1, and it deliberately leaves fixtures,
 * challenges, questions and commercial configuration intact — a demo reset is
 * not a production data-deletion tool.
 */
router.post('/demo/reset', (req, res) => {
  if (process.env.FH_DEMO !== '1') {
    return res.status(403).json({ error: 'DEMO_MODE_OFF' });
  }

  // Order matters: foreign keys are ON, so children go before parents.
  // sessions.fan_id references fans, so sessions must be cleared before fans.
  const wipe = db.transaction(() => {
    db.prepare('DELETE FROM redemptions').run();
    db.prepare('DELETE FROM validation_attempts').run();
    db.prepare('DELETE FROM claims').run();
    db.prepare('DELETE FROM verifications').run();
    db.prepare('DELETE FROM verified_results').run();
    db.prepare('DELETE FROM results').run();
    db.prepare('DELETE FROM answers').run();
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM fans').run();
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM idempotency').run();
    db.prepare('UPDATE offers SET claimed_count = 0').run();
  });
  wipe();

  getSmsProvider().clear?.();
  audit({ actorType: 'admin', action: 'demo_reset', reason: 'demo run restarted' });
  res.json({ ok: true });
});

/* ── Audit trail ────────────────────────────────────────────────── */

router.get('/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  res.json({ entries: rows });
});

export default router;
