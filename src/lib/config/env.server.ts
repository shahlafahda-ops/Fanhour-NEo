import 'server-only';
import { appEnv, isProduction, publicConfig } from './env';

/**
 * SERVER-ONLY configuration and production safety guards. `import 'server-only'`
 * makes importing this from client code a build error, so the service role key
 * and OTP credentials can never reach the browser (prompt §13, §45, §51, §78).
 */

function str(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}
function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const serverConfig = {
  supabaseServiceRoleKey: str('SUPABASE_SERVICE_ROLE_KEY'),
  otpProvider: str('OTP_PROVIDER', 'mock'),
  otpSenderId: str('OTP_SENDER_ID', 'FanHour'),
  // Dedicated pepper for phone/OTP hashes; falls back to the service key for
  // local dev only. Set HASH_PEPPER in production (see LAUNCH_CHECKLIST).
  hashPepper: str('HASH_PEPPER') || str('SUPABASE_SERVICE_ROLE_KEY') || 'dev-only-pepper',
  supportDestination: str('SUPPORT_DESTINATION'),
  privacyPolicyVersion: str('PRIVACY_POLICY_VERSION', 'unversioned'),
  termsVersion: str('TERMS_VERSION', 'unversioned'),
  allowTestData: bool('ALLOW_TEST_DATA', !isProduction),
  defaultCutoffMinutes: num('DEFAULT_CUTOFF_MINUTES_BEFORE_KICKOFF', 5),
};

/** Fail-fast production invariants. Returns a list of problems (empty = OK). */
export function assertProductionSafety(): string[] {
  const errors: string[] = [];
  if (!isProduction) return errors;

  if (serverConfig.otpProvider === 'mock') {
    errors.push('OTP_PROVIDER=mock is forbidden in production.');
  }
  if (serverConfig.allowTestData) {
    errors.push('ALLOW_TEST_DATA=true is forbidden in production.');
  }
  if (!publicConfig.supabaseUrl || !publicConfig.supabaseAnonKey) {
    errors.push('Supabase public configuration is missing.');
  }
  if (!serverConfig.supabaseServiceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }
  if (
    serverConfig.privacyPolicyVersion === 'unversioned' ||
    serverConfig.termsVersion === 'unversioned'
  ) {
    errors.push('Legal document versions must be set in production.');
  }
  return errors;
}

export function isTestDataAllowed(): boolean {
  return serverConfig.allowTestData && !isProduction;
}

export { appEnv, isProduction, publicConfig };
