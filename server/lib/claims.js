import { db } from '../db.js';
import {
  uid, secureToken, shortCode, track, audit, iso, isPast, hashPhone,
} from './core.js';

/*
 * Claim state machine (B3):
 *   AVAILABLE -> VERIFICATION_PENDING -> ISSUED -> REDEEMED | EXPIRED | VOID | MANUAL_REVIEW
 *
 * Hard rules enforced here:
 *   - no claim issuance before OTP_VERIFIED
 *   - one claim per verified fan/offer (DB uniqueness, not app logic)
 *   - atomic cap decrement so concurrent claims cannot oversubscribe
 *   - idempotent issue and redeem
 */

export const CLAIM_TTL_HOURS = 72;

export const getOffer = (id) => db.prepare('SELECT * FROM offers WHERE id = ?').get(id);

/** The offer attached to a challenge. Score-independent by construction: nothing
 *  in this lookup consults the fan's result. */
export function getOfferForChallenge(challengeId) {
  return db.prepare(`
    SELECT o.*, s.name_ar AS sponsor_name_ar, s.tier AS sponsor_tier
      FROM offers o
      JOIN sponsors s ON s.id = o.sponsor_id
     WHERE o.challenge_id = ? AND o.active = 1
     ORDER BY o.rowid ASC LIMIT 1
  `).get(challengeId);
}

export function offerAvailability(offer) {
  if (!offer) return { available: false, reason: 'NO_OFFER' };
  if (!offer.active) return { available: false, reason: 'INACTIVE' };
  if (isPast(offer.expires_at)) return { available: false, reason: 'EXPIRED' };
  if (offer.claimed_count >= offer.cap_total) return { available: false, reason: 'CAP_REACHED' };
  return { available: true, remaining: offer.cap_total - offer.claimed_count };
}

/* ── Fan identity (created only at successful OTP) ──────────────── */

const ALIAS_PREFIXES = ['مشجّع', 'نسر', 'أسد', 'فارس', 'بطل'];

function makeAlias() {
  const p = ALIAS_PREFIXES[Math.floor(Math.random() * ALIAS_PREFIXES.length)];
  return `${p} الحزم ${Math.floor(Math.random() * 9000) + 1000}`;
}

/**
 * Find or create the pseudonymous fan record for a verified phone number.
 * The raw number is hashed on the way in and never persisted.
 */
export function upsertFan({ e164, birthYear, locality, termsVersion, marketingConsent }) {
  const phone_hash = hashPhone(e164);
  const existing = db.prepare('SELECT * FROM fans WHERE phone_hash = ?').get(phone_hash);
  if (existing) {
    // Locality can change legitimately between fixtures; keep it current.
    db.prepare('UPDATE fans SET locality = ? WHERE id = ?').run(locality, existing.id);
    if (marketingConsent && !existing.marketing_consent) {
      db.prepare(`UPDATE fans SET marketing_consent = 1, marketing_consent_at = ? WHERE id = ?`)
        .run(iso(), existing.id);
    }
    return db.prepare('SELECT * FROM fans WHERE id = ?').get(existing.id);
  }

  const id = uid('fan');
  db.prepare(`
    INSERT INTO fans (id, phone_hash, phone_last2, alias_ar, birth_year, locality,
                      marketing_consent, marketing_consent_at, terms_version, terms_accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, phone_hash, e164.slice(-2), makeAlias(), birthYear, locality,
    marketingConsent ? 1 : 0, marketingConsent ? iso() : null, termsVersion, iso(),
  );
  return db.prepare('SELECT * FROM fans WHERE id = ?').get(id);
}

/**
 * Bind a completed anonymous session to a verified fan and, if this is the
 * fan's first verified result for the fixture, record it in the official cohort.
 * Later sessions for the same fixture stay anonymous product events (B4).
 */
export function bindSessionToFan(session, fan) {
  db.prepare('UPDATE sessions SET fan_id = ? WHERE id = ?').run(fan.id, session.id);

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(session.challenge_id);
  const result = db.prepare('SELECT * FROM results WHERE session_id = ?').get(session.id);
  if (!result) return { firstVerified: false };

  try {
    db.prepare(`
      INSERT INTO verified_results (fan_id, fixture_id, session_id, score, accuracy)
      VALUES (?, ?, ?, ?, ?)
    `).run(fan.id, challenge.fixture_id, session.id, result.score, result.accuracy);
    return { firstVerified: true };
  } catch (e) {
    if (String(e.message).includes('UNIQUE') || String(e.message).includes('PRIMARY KEY')) {
      return { firstVerified: false };
    }
    throw e;
  }
}

/* ── Claim issuance ─────────────────────────────────────────────── */

/**
 * Issue a single-use claim.
 *
 * The whole body runs in one SQLite transaction. The cap is decremented with a
 * conditional UPDATE, so two concurrent requests cannot both pass the check —
 * whichever loses sees zero rows changed and is rejected.
 */
export const issueClaim = db.transaction(({ fan, offer, session, verification }) => {
  if (verification.state !== 'OTP_VERIFIED') {
    return { ok: false, reason: 'NOT_VERIFIED' };
  }

  const fresh = db.prepare('SELECT * FROM offers WHERE id = ?').get(offer.id);
  if (isPast(fresh.expires_at)) return { ok: false, reason: 'OFFER_EXPIRED' };

  // Atomic cap decrement: the WHERE clause is the concurrency guard.
  const capped = db.prepare(`
    UPDATE offers SET claimed_count = claimed_count + 1
     WHERE id = ? AND active = 1 AND claimed_count < cap_total
  `).run(fresh.id);

  if (capped.changes === 0) return { ok: false, reason: 'CAP_REACHED' };

  const expiresAt = new Date(Date.now() + CLAIM_TTL_HOURS * 3600 * 1000);
  const offerExpiry = new Date(`${fresh.expires_at.replace(' ', 'T')}Z`);
  const effectiveExpiry = expiresAt < offerExpiry ? expiresAt : offerExpiry;

  const id = uid('clm');
  try {
    db.prepare(`
      INSERT INTO claims (id, fan_id, offer_id, session_id, token, short_code, state, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ISSUED', ?)
    `).run(id, fan.id, fresh.id, session.id, secureToken(), shortCode(), iso(effectiveExpiry));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      // One claim per verified fan/offer. Give back the cap slot we just took.
      db.prepare('UPDATE offers SET claimed_count = claimed_count - 1 WHERE id = ?').run(fresh.id);
      const prior = db.prepare('SELECT * FROM claims WHERE fan_id = ? AND offer_id = ?')
        .get(fan.id, fresh.id);
      return { ok: false, reason: 'ALREADY_CLAIMED', claim: prior };
    }
    throw e;
  }

  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(id);

  audit({
    actorType: 'fan', actorId: fan.id, action: 'claim_issued',
    subjectType: 'claim', subjectId: claim.id,
    detail: { offer_id: fresh.id, session_id: session.id },
  });

  return { ok: true, claim };
});

/** Public claim view. Deliberately excludes the server token. */
export function publicClaim(claim, offer) {
  return {
    id: claim.id,
    shortCode: claim.short_code,
    state: claim.state,
    issuedAt: claim.issued_at,
    expiresAt: claim.expires_at,
    offer: offer && {
      title_ar: offer.title_ar,
      benefit_ar: offer.benefit_ar,
      terms_ar: offer.terms_ar,
      excluded_ar: offer.excluded_ar,
      valid_hours_ar: offer.valid_hours_ar,
      sponsor_name_ar: offer.sponsor_name_ar,
      escalation_contact: offer.escalation_contact,
    },
  };
}

/* ── Merchant validation ────────────────────────────────────────── */

export const VALIDATION_RESULTS = {
  VALID: 'VALID',
  EXPIRED: 'EXPIRED',
  ALREADY_REDEEMED: 'ALREADY_REDEEMED',
  WRONG_OFFER_LOCATION: 'WRONG_OFFER_LOCATION',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  NOT_FOUND: 'NOT_FOUND',
};

const normalizeCode = (c) => String(c || '').trim().toUpperCase().replace(/\s/g, '');

/**
 * Look up a claim by short code or token and decide what the merchant sees.
 * Read-only — confirming the redemption is a separate, explicit step.
 */
export function inspectClaim(rawCode, outletId) {
  const code = normalizeCode(rawCode);
  const claim = db.prepare(`
    SELECT * FROM claims WHERE UPPER(short_code) = ? OR token = ?
  `).get(code, String(rawCode || '').trim());

  if (!claim) return { result: VALIDATION_RESULTS.NOT_FOUND };

  const offer = db.prepare(`
    SELECT o.*, s.name_ar AS sponsor_name_ar FROM offers o
      JOIN sponsors s ON s.id = o.sponsor_id WHERE o.id = ?
  `).get(claim.offer_id);

  // Outlet scoping: a code issued for another sponsor's offer must not validate here.
  const eligible = db.prepare(`
    SELECT 1 FROM offer_outlets WHERE offer_id = ? AND outlet_id = ?
  `).get(claim.offer_id, outletId);
  if (!eligible) {
    return { result: VALIDATION_RESULTS.WRONG_OFFER_LOCATION, claim, offer };
  }

  if (claim.state === 'REDEEMED')      return { result: VALIDATION_RESULTS.ALREADY_REDEEMED, claim, offer };
  if (claim.state === 'MANUAL_REVIEW') return { result: VALIDATION_RESULTS.MANUAL_REVIEW, claim, offer };
  if (claim.state === 'VOID')          return { result: VALIDATION_RESULTS.EXPIRED, claim, offer };
  if (isPast(claim.expires_at)) {
    db.prepare(`UPDATE claims SET state = 'EXPIRED' WHERE id = ? AND state = 'ISSUED'`).run(claim.id);
    return { result: VALIDATION_RESULTS.EXPIRED, claim, offer };
  }

  return { result: VALIDATION_RESULTS.VALID, claim, offer };
}

/**
 * Confirm a redemption.
 *
 * Guarded by a conditional UPDATE on state plus a UNIQUE claim_id on
 * redemptions, so a retry, a double-tap, or a shared screenshot can never
 * produce a second redemption.
 */
export const confirmRedemption = db.transaction(({ claim, outletId, staffId, manualReason }) => {
  const moved = db.prepare(`
    UPDATE claims SET state = 'REDEEMED' WHERE id = ? AND state = 'ISSUED'
  `).run(claim.id);

  if (moved.changes === 0) {
    const current = db.prepare('SELECT state FROM claims WHERE id = ?').get(claim.id);
    return { ok: false, reason: current?.state === 'REDEEMED' ? 'ALREADY_REDEEMED' : 'NOT_REDEEMABLE' };
  }

  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(claim.offer_id);
  const id = uid('rdm');

  db.prepare(`
    INSERT INTO redemptions (id, claim_id, offer_id, sponsor_id, outlet_id, staff_id,
                             issued_at, status, manual_override_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
  `).run(id, claim.id, offer.id, offer.sponsor_id, outletId, staffId, claim.issued_at, manualReason || null);

  audit({
    actorType: 'staff', actorId: staffId, action: 'redemption_confirmed',
    subjectType: 'claim', subjectId: claim.id,
    reason: manualReason || null,
    detail: { outlet_id: outletId, offer_id: offer.id },
  });

  return { ok: true, redemptionId: id };
});

/* ── Fraud/anomaly thresholds (section 13) ──────────────────────── */

export function staffVelocityAlert(staffId) {
  const row = db.prepare(`
    SELECT COUNT(*) c FROM redemptions
     WHERE staff_id = ? AND redeemed_at > datetime('now', '-2 minutes')
  `).get(staffId);
  return row.c >= 5;   // 5 validations from one staff identity inside two minutes
}
