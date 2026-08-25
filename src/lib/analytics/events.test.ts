import { describe, it, expect } from 'vitest';
import { sanitizeProps, SERVER_AUTHORITATIVE, EVENTS } from './events';

describe('analytics safety', () => {
  it('strips forbidden PII keys from props', () => {
    const out = sanitizeProps({ phone: '+9665...', otp: '123456', token: 'abc', source: 'x_post' });
    expect(out).toEqual({ source: 'x_post' });
  });

  it('marks redemption_validated as server-authoritative', () => {
    expect(SERVER_AUTHORITATIVE.has(EVENTS.redemption_validated)).toBe(true);
    expect(SERVER_AUTHORITATIVE.has(EVENTS.fixture_viewed)).toBe(false);
  });
});
