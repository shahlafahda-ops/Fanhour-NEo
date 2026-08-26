import { describe, it, expect, afterEach, vi } from 'vitest';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
});

async function loadEnv(overrides: Record<string, string>) {
  process.env = { ...ORIGINAL, ...overrides };
  vi.resetModules();
  return import('./env.server');
}

describe('production safety guards', () => {
  it('rejects mock OTP + test data in production', async () => {
    const env = await loadEnv({
      NEXT_PUBLIC_APP_ENV: 'production',
      OTP_PROVIDER: 'mock',
      ALLOW_TEST_DATA: 'true',
    });
    const errors = env.assertProductionSafety();
    expect(errors.some((e) => e.includes('OTP_PROVIDER=mock'))).toBe(true);
    expect(errors.some((e) => e.includes('ALLOW_TEST_DATA'))).toBe(true);
  });

  it('passes with a valid production configuration', async () => {
    const env = await loadEnv({
      NEXT_PUBLIC_APP_ENV: 'production',
      OTP_PROVIDER: 'twilio',
      ALLOW_TEST_DATA: 'false',
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      PRIVACY_POLICY_VERSION: '2026-08',
      TERMS_VERSION: '2026-08',
    });
    expect(env.assertProductionSafety()).toEqual([]);
  });

  it('never allows test data in production regardless of flag', async () => {
    const env = await loadEnv({ NEXT_PUBLIC_APP_ENV: 'production', ALLOW_TEST_DATA: 'true' });
    expect(env.isTestDataAllowed()).toBe(false);
  });
});
