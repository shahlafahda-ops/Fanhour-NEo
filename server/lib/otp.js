import crypto from 'node:crypto';
import { db } from '../db.js';
import { hashSecret, safeEqual, iso, isPast } from './core.js';
import { getSmsProvider } from './sms.js';

/*
 * OTP abuse controls (Appendix B4):
 *   - resend cooldown
 *   - attempt limits
 *   - IP/device/session velocity monitoring
 *   - a clear recovery path (the challenge result stays visible throughout)
 */
export const OTP_TTL_SECONDS      = 5 * 60;
export const OTP_MAX_ATTEMPTS     = 5;
export const OTP_MAX_RESENDS      = 3;
export const OTP_RESEND_COOLDOWN  = 60;      // seconds
export const OTP_VELOCITY_WINDOW  = 60 * 60; // seconds
export const OTP_VELOCITY_MAX     = 10;      // sends per phone per window

/** 6 digits, uniformly sampled — Math.random() is not acceptable for a credential. */
export function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

const countRecentSends = db.prepare(`
  SELECT COUNT(*) AS c FROM events
   WHERE name = 'verification_start'
     AND json_extract(props, '$.phone_bucket') = ?
     AND occurred_at > datetime('now', ?)
`);

/** Velocity check keyed on a coarse hash bucket so no phone number lands in analytics. */
export function phoneBucket(phoneHash) {
  return phoneHash.slice(0, 12);
}

export function velocityExceeded(phoneHash) {
  const row = countRecentSends.get(phoneBucket(phoneHash), `-${OTP_VELOCITY_WINDOW} seconds`);
  return row.c >= OTP_VELOCITY_MAX;
}

const updateSend = db.prepare(`
  UPDATE verifications
     SET state = 'OTP_SENT', otp_hash = @otp_hash, otp_sent_at = @sent_at,
         otp_expires_at = @expires_at, resends = resends + @inc, attempts = 0
   WHERE id = @id
`);

export function cooldownRemaining(verification) {
  if (!verification.otp_sent_at) return 0;
  const sentMs = new Date(`${verification.otp_sent_at.replace(' ', 'T')}Z`).getTime();
  const elapsed = (Date.now() - sentMs) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN - elapsed));
}

/**
 * Send (or resend) an OTP. Returns a discriminated result rather than throwing
 * so the route can map each case to a specific Arabic message.
 */
export async function sendOtp(verification, e164, { isResend = false } = {}) {
  if (isResend) {
    const wait = cooldownRemaining(verification);
    if (wait > 0) return { ok: false, reason: 'COOLDOWN', retryAfter: wait };
    if (verification.resends >= OTP_MAX_RESENDS) return { ok: false, reason: 'RESEND_LIMIT' };
  }
  if (velocityExceeded(verification.phone_hash)) {
    db.prepare(`UPDATE verifications SET state = 'RATE_LIMITED' WHERE id = ?`).run(verification.id);
    return { ok: false, reason: 'RATE_LIMITED' };
  }

  const code = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  updateSend.run({
    id: verification.id,
    otp_hash: hashSecret(code),
    sent_at: iso(),
    expires_at: iso(expires),
    inc: isResend ? 1 : 0,
  });

  await getSmsProvider().sendOtp(e164, code);
  return { ok: true, expiresAt: expires.toISOString() };
}

/**
 * Verify a submitted code.
 *
 * A failed attempt never destroys the fan's challenge result — the spec
 * requires that the fan can retry verification without replaying the challenge.
 */
export function verifyOtp(verification, submitted) {
  if (verification.state === 'OTP_VERIFIED') return { ok: true, alreadyVerified: true };
  if (verification.state === 'RATE_LIMITED')  return { ok: false, reason: 'RATE_LIMITED' };
  if (!verification.otp_hash)                 return { ok: false, reason: 'NOT_SENT' };
  if (isPast(verification.otp_expires_at))    return { ok: false, reason: 'EXPIRED' };

  if (verification.attempts >= OTP_MAX_ATTEMPTS) {
    db.prepare(`UPDATE verifications SET state = 'RATE_LIMITED' WHERE id = ?`).run(verification.id);
    return { ok: false, reason: 'ATTEMPT_LIMIT' };
  }

  db.prepare(`UPDATE verifications SET attempts = attempts + 1 WHERE id = ?`).run(verification.id);

  if (!safeEqual(hashSecret(String(submitted)), verification.otp_hash)) {
    const left = OTP_MAX_ATTEMPTS - (verification.attempts + 1);
    return { ok: false, reason: 'INCORRECT', attemptsLeft: Math.max(0, left) };
  }

  // Burn the code on success so it cannot be replayed.
  db.prepare(`
    UPDATE verifications SET state = 'OTP_VERIFIED', otp_hash = NULL WHERE id = ?
  `).run(verification.id);
  return { ok: true };
}
