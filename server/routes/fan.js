import express from 'express';
import { db } from '../db.js';
import {
  track, uid, normalizeSaudiMobile, isAdultByBirthYear, LOCALITIES, idempotent, hashPhone,
} from '../lib/core.js';
import {
  getLiveChallenge, getNextFixture, createSession, getSession, getQuestionsForSession,
  submitAnswer, completeChallenge, buildResult, setSessionState, getMatchweekStatus,
  effectiveState, getChallengeById,
} from '../lib/challenge.js';
import {
  getOfferForChallenge, offerAvailability, upsertFan, bindSessionToFan,
  issueClaim, publicClaim, getOffer,
} from '../lib/claims.js';
import { sendOtp, verifyOtp, cooldownRemaining } from '../lib/otp.js';
import { getSmsProvider } from '../lib/sms.js';

export const TERMS_VERSION = 'ahz-pilot-terms-v1';
const router = express.Router();

/** Resolve the session from the header and fail closed if it is unknown. */
function requireSession(req, res) {
  const id = req.get('x-fh-session') || req.body?.sessionId;
  const session = id ? getSession(id) : null;
  if (!session) {
    res.status(401).json({ error: 'SESSION_REQUIRED', message_ar: 'انتهت الجلسة. افتح التحدي من جديد.' });
    return null;
  }
  return session;
}

/* ── Landing ────────────────────────────────────────────────────── */

router.get('/challenge/live', (req, res) => {
  const challenge = getLiveChallenge();
  const next = getNextFixture();

  if (!challenge) {
    return res.json({
      open: false,
      // No artificial weekly challenge during league gaps (section 9).
      nextFixture: next && {
        pilot_index: next.pilot_index,
        opponent_ar: next.opponent_ar,
        home_away: next.home_away,
        kickoff_at: next.kickoff_at,
        opponent_confirmed: !!next.opponent_confirmed,
      },
      message_ar: 'لا يوجد تحدٍ مفتوح حاليًا. عد عند الجولة القادمة.',
    });
  }

  const offer = getOfferForChallenge(challenge.id);
  track('landing_view', {
    challenge_id: challenge.id,
    challenge_version: challenge.version,
    fixture_id: challenge.fixture_id,
    source: req.query.src || null,
  });

  res.json({
    open: true,
    demoMode: process.env.FH_DEMO === '1',
    challenge: {
      id: challenge.id,
      title_ar: challenge.title_ar,
      version: challenge.version,
      closes_at: challenge.closes_at,
      fixture: {
        pilot_index: challenge.pilot_index,
        opponent_ar: challenge.opponent_ar,
        home_away: challenge.home_away,
        kickoff_at: challenge.kickoff_at,
        matchweek: challenge.matchweek,
      },
    },
    // Sponsor benefit is teased, never the hero (section 8).
    offerTeaser: offer && { sponsor_name_ar: offer.sponsor_name_ar, title_ar: offer.title_ar },
    questionCount: 3,
  });
});

/* ── Challenge ──────────────────────────────────────────────────── */

router.post('/challenge/start', (req, res) => {
  const challenge = getLiveChallenge();
  if (!challenge || effectiveState(challenge) !== 'OPEN') {
    return res.status(409).json({ error: 'CHALLENGE_CLOSED', message_ar: 'التحدي مغلق حاليًا.' });
  }

  // No identity, no phone, no OTP — the whole point of the base flow.
  const { id } = createSession(challenge.id, req.body?.source || null);
  const session = getSession(id);

  track('challenge_start', {
    session_id: id,
    challenge_id: challenge.id,
    challenge_version: challenge.version,
    fixture_id: challenge.fixture_id,
    source: session.source,
  });

  res.json({
    sessionId: id,
    challenge: { id: challenge.id, title_ar: challenge.title_ar, closes_at: challenge.closes_at },
    questions: getQuestionsForSession(session),
  });
});

router.post('/challenge/answer', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const { questionId, optionId } = req.body || {};
  const out = submitAnswer(session, questionId, optionId);
  if (!out.ok) {
    const messages = {
      CHALLENGE_LOCKED: 'أُغلق التحدي.',
      ALREADY_ANSWERED: 'تمت الإجابة على هذا السؤال.',
      ALREADY_COMPLETE: 'أكملت هذا التحدي.',
      INVALID_OPTION: 'خيار غير صحيح.',
      QUESTION_NOT_IN_SESSION: 'سؤال غير معروف لهذه الجلسة.',
    };
    return res.status(409).json({ error: out.reason, message_ar: messages[out.reason] });
  }
  // The response never reveals whether the answer was right — that would leak
  // the answer key before the challenge closes.
  res.json({ answered: out.answered, total: out.total });
});

router.post('/challenge/complete', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const out = completeChallenge(session);
  if (!out.ok) {
    return res.status(409).json({
      error: out.reason,
      message_ar: 'أكمل جميع الأسئلة أولًا.',
      answered: out.answered, total: out.total,
    });
  }
  res.json({ result: out.result });
});

/**
 * The result endpoint is intentionally re-readable.
 * B9 requires the result to remain visible if OTP fails, without replaying.
 */
router.get('/result', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const row = db.prepare('SELECT * FROM results WHERE session_id = ?').get(session.id);
  if (!row) return res.status(404).json({ error: 'NO_RESULT' });

  if (session.state === 'COMPLETED') setSessionState(session.id, 'RESULT_VIEWED');
  const challenge = getChallengeById(session.challenge_id);
  track('result_view', {
    session_id: session.id, challenge_id: challenge.id,
    challenge_version: challenge.version, fixture_id: challenge.fixture_id,
  });

  res.json({ result: buildResult(session, row) });
});

/** Secondary, optional. Anonymous fans may view it — verification is never
 *  required merely to look at status (B11). */
router.get('/status', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  res.json(getMatchweekStatus(session.challenge_id, session.id));
});

/* ── Offer ──────────────────────────────────────────────────────── */

router.get('/offer', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  // Gated on completion, never on score — the benefit is score-independent.
  const result = db.prepare('SELECT * FROM results WHERE session_id = ?').get(session.id);
  if (!result) return res.status(409).json({ error: 'COMPLETE_CHALLENGE_FIRST' });

  const offer = getOfferForChallenge(session.challenge_id);
  const availability = offerAvailability(offer);
  if (!offer) return res.json({ offer: null });

  track('offer_view', {
    session_id: session.id, challenge_id: session.challenge_id,
    props: { offer_id: offer.id },
  });

  res.json({
    offer: {
      id: offer.id,
      sponsor_name_ar: offer.sponsor_name_ar,
      title_ar: offer.title_ar,
      benefit_ar: offer.benefit_ar,
      terms_ar: offer.terms_ar,
      excluded_ar: offer.excluded_ar,
      valid_hours_ar: offer.valid_hours_ar,
      expires_at: offer.expires_at,
      escalation_contact: offer.escalation_contact,
    },
    availability,
    // Stated plainly so the fan knows the benefit does not depend on the score.
    independence_note_ar: 'هذه المزية متاحة لكل من أكمل التحدي، بغض النظر عن عدد الإجابات الصحيحة.',
  });
});

/* ── Claim gate ─────────────────────────────────────────────────── */

router.post('/claim/intent', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const offer = getOfferForChallenge(session.challenge_id);
  const availability = offerAvailability(offer);
  if (!availability.available) {
    return res.status(409).json({ error: availability.reason, message_ar: 'هذه المزية غير متاحة حاليًا.' });
  }

  setSessionState(session.id, 'CLAIM_INTENT');
  track('claim_intent', {
    session_id: session.id, challenge_id: session.challenge_id,
    props: { offer_id: offer.id },
  });

  res.json({
    ok: true,
    offerId: offer.id,
    termsVersion: TERMS_VERSION,
    required_ar: {
      age: 'يجب أن يكون عمرك 18 سنة أو أكثر للحصول على المزية.',
      data: 'نطلب سنة الميلاد ومنطقة السكن ورقم الجوال فقط — لا نطلب موقعك الجغرافي ولا عنوانك.',
    },
    localities: [
      { key: 'al_rass',      label_ar: 'الرس' },
      { key: 'qassim_other', label_ar: 'مكان آخر في القصيم' },
      { key: 'ksa_other',    label_ar: 'مكان آخر في السعودية' },
      { key: 'outside_ksa',  label_ar: 'خارج السعودية' },
    ],
  });
});

/** Eligibility + OTP send. This is the first point in the whole flow that
 *  touches personal data, and it happens only after claim intent. */
router.post('/claim/verify/start', async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const { birthYear, locality, mobile, acceptTerms, offerId } = req.body || {};

  if (!acceptTerms) {
    return res.status(400).json({ error: 'TERMS_REQUIRED', message_ar: 'يجب الموافقة على شروط الاستفادة وسياسة الخصوصية.' });
  }
  if (!isAdultByBirthYear(birthYear)) {
    return res.status(403).json({ error: 'AGE_INELIGIBLE', message_ar: 'المزايا متاحة لمن عمرهم 18 سنة فأكثر.' });
  }
  if (!LOCALITIES.includes(locality)) {
    return res.status(400).json({ error: 'LOCALITY_REQUIRED', message_ar: 'اختر منطقة السكن.' });
  }
  const e164 = normalizeSaudiMobile(mobile);
  if (!e164) {
    return res.status(400).json({ error: 'INVALID_MOBILE', message_ar: 'أدخل رقم جوال سعودي صحيح (يبدأ بـ 05).' });
  }

  const offer = offerId ? getOffer(offerId) : getOfferForChallenge(session.challenge_id);
  if (!offer) return res.status(404).json({ error: 'NO_OFFER' });

  const phone_hash = hashPhone(e164);
  let verification = db.prepare(`
    SELECT * FROM verifications WHERE session_id = ? AND offer_id = ?
  `).get(session.id, offer.id);

  if (!verification) {
    const id = uid('vrf');
    db.prepare(`
      INSERT INTO verifications (id, session_id, offer_id, state, phone_hash, birth_year, locality)
      VALUES (?, ?, ?, 'ELIGIBILITY_OK', ?, ?, ?)
    `).run(id, session.id, offer.id, phone_hash, birthYear, locality);
    verification = db.prepare('SELECT * FROM verifications WHERE id = ?').get(id);
  } else {
    db.prepare(`
      UPDATE verifications SET phone_hash = ?, birth_year = ?, locality = ?,
             state = CASE WHEN state = 'OTP_VERIFIED' THEN state ELSE 'ELIGIBILITY_OK' END
       WHERE id = ?
    `).run(phone_hash, birthYear, locality, verification.id);
    verification = db.prepare('SELECT * FROM verifications WHERE id = ?').get(verification.id);
  }

  track('verification_start', {
    session_id: session.id, challenge_id: session.challenge_id,
    props: { offer_id: offer.id, phone_bucket: phone_hash.slice(0, 12), locality },
  });

  const isResend = !!req.body?.resend;
  const out = await sendOtp(verification, e164, { isResend });
  if (!out.ok) {
    const messages = {
      COOLDOWN: `يمكنك طلب رمز جديد بعد ${out.retryAfter} ثانية.`,
      RESEND_LIMIT: 'تجاوزت عدد مرات إعادة الإرسال. تواصل مع الدعم.',
      RATE_LIMITED: 'تم تجاوز الحد المسموح. حاول لاحقًا أو تواصل مع الدعم.',
    };
    return res.status(429).json({ error: out.reason, message_ar: messages[out.reason], retryAfter: out.retryAfter });
  }

  const payload = {
    ok: true,
    verificationId: verification.id,
    expiresAt: out.expiresAt,
    mobileLast2: e164.slice(-2),
  };

  /*
   * Demo mode returns the OTP so the journey can be filmed on a real phone
   * without a live SMS route. It is gated behind FH_DEMO and the response is
   * flagged, so a demo build is impossible to mistake for a production one.
   * The launch-readiness gate fails while FH_DEMO is set.
   */
  if (process.env.FH_DEMO === '1') {
    payload.demoOtp = getSmsProvider().lastFor(e164)?.code || null;
    payload.demoMode = true;
  }

  res.json(payload);
});

/** OTP check + claim issuance. Verification must never occur later than
 *  claim issuance, so the two are bound together here. */
router.post('/claim/verify/confirm', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const { verificationId, code, marketingConsent, mobile } = req.body || {};
  const verification = db.prepare('SELECT * FROM verifications WHERE id = ? AND session_id = ?')
    .get(verificationId, session.id);
  if (!verification) return res.status(404).json({ error: 'VERIFICATION_NOT_FOUND' });

  const check = verifyOtp(verification, code);
  if (!check.ok) {
    const messages = {
      INCORRECT: 'الرمز غير صحيح.',
      EXPIRED: 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.',
      RATE_LIMITED: 'تم تجاوز الحد المسموح.',
      ATTEMPT_LIMIT: 'تجاوزت عدد المحاولات. اطلب رمزًا جديدًا.',
      NOT_SENT: 'لم يتم إرسال رمز بعد.',
    };
    // Result stays intact; the fan can retry without replaying the challenge.
    return res.status(400).json({
      error: check.reason,
      message_ar: messages[check.reason],
      attemptsLeft: check.attemptsLeft,
      resultStillAvailable: true,
    });
  }

  const e164 = normalizeSaudiMobile(mobile);
  if (!e164) return res.status(400).json({ error: 'INVALID_MOBILE' });

  track('otp_verified', { session_id: session.id, challenge_id: session.challenge_id });

  const fan = upsertFan({
    e164,
    birthYear: verification.birth_year,
    locality: verification.locality,
    termsVersion: TERMS_VERSION,
    marketingConsent: !!marketingConsent,   // separate, optional, default off
  });

  bindSessionToFan(session, fan);

  const offer = getOffer(verification.offer_id);
  const idemKey = req.get('idempotency-key') || `${session.id}:${offer.id}`;

  const outcome = idempotent(idemKey, 'claim_issue', () =>
    issueClaim({ fan, offer, session, verification: db.prepare('SELECT * FROM verifications WHERE id = ?').get(verification.id) }),
  );

  if (!outcome.ok) {
    if (outcome.reason === 'ALREADY_CLAIMED' && outcome.claim) {
      const full = db.prepare(`
        SELECT o.*, s.name_ar AS sponsor_name_ar FROM offers o
          JOIN sponsors s ON s.id = o.sponsor_id WHERE o.id = ?
      `).get(offer.id);
      return res.json({ claim: publicClaim(outcome.claim, full), alreadyClaimed: true });
    }
    const messages = {
      CAP_REACHED: 'انتهت الكمية المتاحة من هذه المزية.',
      OFFER_EXPIRED: 'انتهت صلاحية هذه المزية.',
      NOT_VERIFIED: 'لم يكتمل التحقق.',
    };
    return res.status(409).json({ error: outcome.reason, message_ar: messages[outcome.reason] });
  }

  const full = db.prepare(`
    SELECT o.*, s.name_ar AS sponsor_name_ar FROM offers o
      JOIN sponsors s ON s.id = o.sponsor_id WHERE o.id = ?
  `).get(offer.id);

  track('claim_issued', {
    session_id: session.id, fan_id: fan.id, challenge_id: session.challenge_id,
    props: { offer_id: offer.id },
  });

  res.json({ claim: publicClaim(outcome.claim, full), replayed: outcome.replayed });
});

/* ── Claim + history ────────────────────────────────────────────── */

router.get('/claim/:id', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const claim = db.prepare('SELECT * FROM claims WHERE id = ? AND session_id = ?')
    .get(req.params.id, session.id);
  if (!claim) return res.status(404).json({ error: 'CLAIM_NOT_FOUND' });

  const offer = db.prepare(`
    SELECT o.*, s.name_ar AS sponsor_name_ar FROM offers o
      JOIN sponsors s ON s.id = o.sponsor_id WHERE o.id = ?
  `).get(claim.offer_id);

  res.json({ claim: publicClaim(claim, offer) });
});

/** Personal history for a verified fan, plus the next-fixture return cue. */
router.get('/history', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (!session.fan_id) return res.json({ verified: false, history: [] });

  const history = db.prepare(`
    SELECT vr.score, vr.accuracy, vr.created_at, f.pilot_index, f.opponent_ar, f.home_away
      FROM verified_results vr
      JOIN fixtures f ON f.id = vr.fixture_id
     WHERE vr.fan_id = ?
     ORDER BY f.kickoff_at DESC
  `).all(session.fan_id);

  const claims = db.prepare(`
    SELECT c.state, c.short_code, c.expires_at, o.title_ar, s.name_ar AS sponsor_name_ar
      FROM claims c
      JOIN offers o ON o.id = c.offer_id
      JOIN sponsors s ON s.id = o.sponsor_id
     WHERE c.fan_id = ? ORDER BY c.issued_at DESC
  `).all(session.fan_id);

  const next = getNextFixture();
  res.json({ verified: true, history, claims, nextFixture: next });
});

export default router;
