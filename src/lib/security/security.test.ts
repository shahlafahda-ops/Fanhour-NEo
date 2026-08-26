import { describe, it, expect } from 'vitest';
import {
  generateOtpCode,
  hashOtp,
  verifyOtp,
  isOtpExpired,
  canResend,
  OTP_LENGTH,
} from './otp';
import {
  generateRedemptionToken,
  hashRedemptionToken,
  verifyRedemptionToken,
  generateFallbackCode,
} from './tokens';
import { normalizeSaudiMobile, isValidSaudiMobile, phoneLookupHash } from './phone';

const PEPPER = 'test-pepper';

// Prompt §73 — OTP tests.
describe('OTP security', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('verifies a valid code and rejects a wrong one', () => {
    const code = '123456';
    const cid = 'challenge-1';
    const hash = hashOtp(code, cid, PEPPER);
    expect(verifyOtp('123456', hash, cid, PEPPER)).toBe(true);
    expect(verifyOtp('654321', hash, cid, PEPPER)).toBe(false);
  });

  it('binds the hash to the challenge id (no cross-challenge replay)', () => {
    const hash = hashOtp('123456', 'challenge-A', PEPPER);
    expect(verifyOtp('123456', hash, 'challenge-B', PEPPER)).toBe(false);
  });

  it('requires a pepper', () => {
    expect(() => hashOtp('123456', 'c', '')).toThrow();
  });

  it('detects expiry', () => {
    const created = new Date('2026-09-01T10:00:00Z');
    expect(isOtpExpired(created, new Date('2026-09-01T10:04:00Z'))).toBe(false);
    expect(isOtpExpired(created, new Date('2026-09-01T10:06:00Z'))).toBe(true);
  });

  it('throttles resend', () => {
    const last = new Date('2026-09-01T10:00:00Z');
    expect(canResend(last, new Date('2026-09-01T10:00:30Z'))).toBe(false);
    expect(canResend(last, new Date('2026-09-01T10:01:05Z'))).toBe(true);
    expect(canResend(null, new Date())).toBe(true);
  });
});

describe('redemption tokens', () => {
  it('generates high-entropy opaque tokens (>= 128 bits)', () => {
    const t = generateRedemptionToken();
    // base64url of 24 bytes ~ 32 chars.
    expect(t.length).toBeGreaterThanOrEqual(32);
    expect(t).not.toContain('=');
  });

  it('verifies a token against its hash', () => {
    const t = generateRedemptionToken();
    const h = hashRedemptionToken(t);
    expect(verifyRedemptionToken(t, h)).toBe(true);
    expect(verifyRedemptionToken(generateRedemptionToken(), h)).toBe(false);
  });

  it('generates distinct fallback codes with FH prefix', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) codes.add(generateFallbackCode());
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^FH-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });
});

describe('Saudi phone normalisation', () => {
  it('normalises common formats to E.164', () => {
    expect(normalizeSaudiMobile('0512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('+966512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('966512345678')).toBe('+966512345678');
    expect(normalizeSaudiMobile('0096650 123 4568')).toBe('+966501234568');
  });
  it('rejects invalid numbers', () => {
    expect(normalizeSaudiMobile('0412345678')).toBeNull(); // not starting 5
    expect(normalizeSaudiMobile('05123')).toBeNull();
    expect(isValidSaudiMobile('hello')).toBe(false);
  });
  it('produces a stable peppered lookup hash without exposing the number', () => {
    const h = phoneLookupHash('+966512345678', PEPPER);
    expect(h).toHaveLength(64);
    expect(h).not.toContain('512345678');
    expect(phoneLookupHash('+966512345678', PEPPER)).toBe(h);
  });
});
