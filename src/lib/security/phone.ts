import { createHash } from 'node:crypto';

/**
 * Saudi mobile number normalisation to E.164 (+9665XXXXXXXX).
 * Accepts common local formats: 05XXXXXXXX, 5XXXXXXXX, 9665XXXXXXXX, +9665XXXXXXXX.
 */
export function normalizeSaudiMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let n = digits.startsWith('+') ? digits.slice(1) : digits;

  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('966')) n = n.slice(3);
  else if (n.startsWith('0')) n = n.slice(1);

  // Now n should be 5XXXXXXXX (9 digits, starting with 5).
  if (!/^5\d{8}$/.test(n)) return null;
  return `+966${n}`;
}

export function isValidSaudiMobile(input: string): boolean {
  return normalizeSaudiMobile(input) !== null;
}

/**
 * Deterministic lookup hash for a phone number. Stored (not the raw phone in
 * behavioural tables) so we can find an existing verified supporter without
 * exposing PII. Requires a server-side pepper so the hash is not brute-forceable
 * from the (small) phone-number space alone.
 */
export function phoneLookupHash(e164: string, pepper: string): string {
  if (!pepper) throw new Error('phoneLookupHash requires a server pepper');
  return createHash('sha256').update(`${pepper}:${e164}`).digest('hex');
}
