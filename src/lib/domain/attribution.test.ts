import { describe, it, expect } from 'vitest';
import { normalizeAttributionSource, ATTRIBUTION_SOURCES } from './attribution';

describe('normalizeAttributionSource', () => {
  it('accepts every allowed source verbatim', () => {
    for (const s of ATTRIBUTION_SOURCES) {
      expect(normalizeAttributionSource(s)).toBe(s);
    }
  });
  it('collapses an unrecognised value to unknown, never drops it', () => {
    expect(normalizeAttributionSource('facebook_ad')).toBe('unknown');
    expect(normalizeAttributionSource('<script>')).toBe('unknown');
  });
  it('collapses null/undefined/empty to unknown', () => {
    expect(normalizeAttributionSource(null)).toBe('unknown');
    expect(normalizeAttributionSource(undefined)).toBe('unknown');
    expect(normalizeAttributionSource('')).toBe('unknown');
  });
});
