/**
 * CLIENT-SAFE configuration only. This module may be imported from client
 * components. Server-only secrets live in `env.server.ts` (guarded by
 * `import 'server-only'`) so they can never be bundled into client code
 * (prompt §51, §78).
 */

export type AppEnv = 'development' | 'staging' | 'production';

function str(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const appEnv: AppEnv = (str('NEXT_PUBLIC_APP_ENV', 'development') as AppEnv) || 'development';
export const isProduction = appEnv === 'production';

export const publicConfig = {
  appUrl: str('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  appEnv,
  supabaseUrl: str('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: str('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  communityMinSample: num('COMMUNITY_MIN_SAMPLE', 20),
  benefitMinAge: num('BENEFIT_MIN_AGE', 18),
};
