import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Redemption credential security (prompt §28).
 *
 * The primary security credential is an OPAQUE, high-entropy token (≥128 bits),
 * never a predictable short id or a database primary key. Only its hash is
 * stored; the raw token lives in the QR / claim URL handed to the supporter.
 *
 * A human-friendly fallback code exists for cases where the QR cannot be
 * scanned. It carries enough entropy to resist guessing and is rate-limited at
 * the API layer; it never encodes a database id.
 */

const TOKEN_BYTES = 24; // 192 bits

/** Base32 (Crockford) alphabet — no I, L, O, U to avoid human confusion. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRedemptionToken(): string {
  // URL-safe base64url, 24 bytes => 192 bits of entropy.
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Hash of the token for storage / lookup. */
export function hashRedemptionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyRedemptionToken(submitted: string, storedHash: string): boolean {
  const a = Buffer.from(hashRedemptionToken(submitted), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Human-friendly fallback code, e.g. "FH-7K3M-Q9WD". 8 Crockford chars =>
 * 40 bits of entropy, well beyond guessing given API rate limits, and it does
 * not expose any database id.
 */
export function generateFallbackCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    // Non-null: i < bytes.length by construction.
    out += CROCKFORD[bytes[i]! % CROCKFORD.length];
  }
  return `FH-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function normalizeFallbackCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/^FH/, '');
}
