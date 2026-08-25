import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * OTP primitives (prompt §14).
 *  - Cryptographically secure generation (crypto.randomInt, never Math.random).
 *  - Server-side hashing; the raw code is never stored or logged.
 *  - Constant-time comparison of hashes.
 *
 * Rate limiting, attempt limits, resend throttling and lockout are enforced at
 * the persistence / API layer (see src/lib/security/rateLimit.ts and the
 * otp_challenges table), using the fields returned/consumed here.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Generate a cryptographically secure numeric OTP of OTP_LENGTH digits. */
export function generateOtpCode(): string {
  let code = '';
  for (let i = 0; i < OTP_LENGTH; i += 1) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

/**
 * Hash an OTP for storage. Bound to the challenge id (salt) so an intercepted
 * hash cannot be replayed against a different challenge, and peppered with a
 * server secret so the tiny (10^6) code space is not directly brute-forceable
 * from a leaked hash.
 */
export function hashOtp(code: string, challengeId: string, pepper: string): string {
  if (!pepper) throw new Error('hashOtp requires a server pepper');
  return createHash('sha256').update(`${pepper}:${challengeId}:${code}`).digest('hex');
}

/** Constant-time verification of a submitted code against a stored hash. */
export function verifyOtp(
  submitted: string,
  storedHash: string,
  challengeId: string,
  pepper: string,
): boolean {
  const candidate = hashOtp(submitted, challengeId, pepper);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isOtpExpired(createdAt: Date, now: Date, ttlSeconds = OTP_TTL_SECONDS): boolean {
  return now.getTime() - createdAt.getTime() > ttlSeconds * 1000;
}

export function canResend(
  lastSentAt: Date | null,
  now: Date,
  cooldownSeconds = OTP_RESEND_COOLDOWN_SECONDS,
): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= cooldownSeconds * 1000;
}
