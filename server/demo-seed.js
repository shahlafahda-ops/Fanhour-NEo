/*
 * Demo traffic generator.
 *
 * Populates the board with a realistic prior-engagement picture so a demo can
 * open on "التفاعل موجود" rather than a wall of zeros, and so the live plays
 * from the room visibly add to an existing base.
 *
 * Every record it creates goes through the same code paths as a real fan —
 * server-scored answers, real claim issuance with cap checks, real redemptions
 * through the validator logic. Nothing here writes a fabricated metric.
 *
 * Demo-mode only. Refuses to run unless FH_DEMO=1.
 */
import { db } from './db.js';
import { uid, track, hashPhone } from './lib/core.js';
import { createSession, getSession, submitAnswer, completeChallenge } from './lib/challenge.js';
import { upsertFan, bindSessionToFan, issueClaim, getOfferForChallenge, confirmRedemption, inspectClaim } from './lib/claims.js';

// Weighted so the funnel narrows the way a real one does: plenty of people
// bounce at the landing, most who start do finish, and only some verify.
const PROFILE = {
  landingOnly: 34,
  startedNotFinished: 12,
  finishedNoClaim: 58,
  claimedNotRedeemed: 21,
  claimedAndRedeemed: 17,
};

const LOCALITY_MIX = [
  ...Array(11).fill('al_rass'),
  ...Array(5).fill('qassim_other'),
  ...Array(3).fill('ksa_other'),
  ...Array(1).fill('outside_ksa'),
];

const SOURCES = ['club_post', 'club_story', 'creator', 'merchant_qr'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function answerAll(sessionId, { correctBias = 0.62 } = {}) {
  const session = getSession(sessionId);
  const order = JSON.parse(session.answer_order);
  for (const { questionId } of order) {
    const options = db.prepare('SELECT id, is_correct FROM options WHERE question_id = ?').all(questionId);
    const correct = options.find((o) => o.is_correct);
    const wrong = options.filter((o) => !o.is_correct);
    const choice = Math.random() < correctBias ? correct : pick(wrong);
    submitAnswer(getSession(sessionId), questionId, choice.id);
  }
  completeChallenge(getSession(sessionId));
}

export function generateDemoTraffic() {
  if (process.env.FH_DEMO !== '1') {
    throw new Error('Demo traffic generation requires FH_DEMO=1');
  }

  const challenge = db.prepare(`SELECT * FROM challenges WHERE state = 'OPEN'`).get();
  if (!challenge) throw new Error('No open challenge — run `npm run seed` first');

  const offer = getOfferForChallenge(challenge.id);
  const outlet = db.prepare('SELECT * FROM outlets LIMIT 1').get();
  const staff = db.prepare('SELECT * FROM staff LIMIT 1').get();

  let phoneSeq = 590000000;
  const nextPhone = () => `+966${++phoneSeq}`;

  // Landing-only visitors.
  for (let i = 0; i < PROFILE.landingOnly; i++) {
    track('landing_view', {
      challenge_id: challenge.id,
      challenge_version: challenge.version,
      fixture_id: challenge.fixture_id,
      source: pick(SOURCES),
    });
  }

  // Started but abandoned mid-challenge.
  for (let i = 0; i < PROFILE.startedNotFinished; i++) {
    const { id } = createSession(challenge.id, pick(SOURCES));
    const session = getSession(id);
    track('challenge_start', {
      session_id: id, challenge_id: challenge.id,
      challenge_version: challenge.version, fixture_id: challenge.fixture_id,
    });
    const order = JSON.parse(session.answer_order);
    const first = order[0];
    const opt = db.prepare('SELECT id FROM options WHERE question_id = ? LIMIT 1').get(first.questionId);
    submitAnswer(getSession(id), first.questionId, opt.id);
  }

  const completeOne = (source) => {
    const { id } = createSession(challenge.id, source);
    track('challenge_start', {
      session_id: id, challenge_id: challenge.id,
      challenge_version: challenge.version, fixture_id: challenge.fixture_id,
    });
    answerAll(id);
    track('result_view', {
      session_id: id, challenge_id: challenge.id,
      challenge_version: challenge.version, fixture_id: challenge.fixture_id,
    });
    return id;
  };

  // Completed, saw the result, did not claim.
  for (let i = 0; i < PROFILE.finishedNoClaim; i++) completeOne(pick(SOURCES));

  // Completed and claimed — with and without a merchant redemption.
  const claimAndMaybeRedeem = (redeem) => {
    const sessionId = completeOne(pick(SOURCES));
    const session = getSession(sessionId);

    track('claim_intent', { session_id: sessionId, challenge_id: challenge.id, props: { offer_id: offer.id } });
    track('verification_start', {
      session_id: sessionId, challenge_id: challenge.id,
      props: { offer_id: offer.id, phone_bucket: 'demo' },
    });

    const e164 = nextPhone();
    const fan = upsertFan({
      e164,
      birthYear: 1985 + Math.floor(Math.random() * 20),
      locality: pick(LOCALITY_MIX),
      termsVersion: 'ahz-pilot-terms-v1',
      marketingConsent: Math.random() < 0.34,
    });
    bindSessionToFan(session, fan);
    track('otp_verified', { session_id: sessionId, challenge_id: challenge.id });

    const vid = uid('vrf');
    db.prepare(`
      INSERT INTO verifications (id, session_id, offer_id, state, phone_hash)
      VALUES (?, ?, ?, 'OTP_VERIFIED', ?)
    `).run(vid, sessionId, offer.id, hashPhone(e164));
    const verification = db.prepare('SELECT * FROM verifications WHERE id = ?').get(vid);

    const out = issueClaim({ fan, offer, session, verification });
    if (!out.ok) return;
    track('claim_issued', {
      session_id: sessionId, fan_id: fan.id, challenge_id: challenge.id,
      props: { offer_id: offer.id },
    });

    if (!redeem) return;
    const found = inspectClaim(out.claim.short_code, outlet.id);
    if (found.result !== 'VALID') return;
    confirmRedemption({ claim: found.claim, outletId: outlet.id, staffId: staff.id });
    track('validation_attempt', { props: { result: 'VALID', outlet_id: outlet.id } });
    track('redemption_complete', { props: { offer_id: offer.id, outlet_id: outlet.id } });
  };

  for (let i = 0; i < PROFILE.claimedNotRedeemed; i++) claimAndMaybeRedeem(false);
  for (let i = 0; i < PROFILE.claimedAndRedeemed; i++) claimAndMaybeRedeem(true);

  return {
    landings: db.prepare(`SELECT COUNT(*) c FROM events WHERE name='landing_view'`).get().c,
    completions: db.prepare('SELECT COUNT(*) c FROM results').get().c,
    verifiedFans: db.prepare('SELECT COUNT(*) c FROM fans').get().c,
    claims: db.prepare('SELECT COUNT(*) c FROM claims').get().c,
    redemptions: db.prepare('SELECT COUNT(*) c FROM redemptions').get().c,
  };
}

if (process.argv[1] && process.argv[1].endsWith('demo-seed.js')) {
  console.log(generateDemoTraffic());
}
