/**
 * CLIENT-SAFE configuration only. This module may be imported from client
 * components. Server-only secrets live in `env.server.ts` (guarded by
 * `import 'server-only'`) so they can never be bundled into client code
 * (prompt §51, §78).
 *
 * IMPORTANT: `NEXT_PUBLIC_*` values MUST be read as *static literal* member
 * accesses (`process.env.NEXT_PUBLIC_FOO`) — Next.js only inlines them into the
 * browser bundle when referenced that way. Dynamic access (`process.env[key]`)
 * is NOT inlined and comes back undefined in the browser, which previously made
 * the ops/merchant login report "Supabase config missing".
 */

export type AppEnv = 'development' | 'staging' | 'production';

function toNum(v: string | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const appEnv: AppEnv =
  (process.env.NEXT_PUBLIC_APP_ENV as AppEnv | undefined) || 'development';
export const isProduction = appEnv === 'production';

export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  appEnv,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  // Non-public: read at runtime on the server; falls back to the default in the
  // browser bundle (where these are only ever used via server-rendered props).
  communityMinSample: toNum(process.env.COMMUNITY_MIN_SAMPLE, 20),
  benefitMinAge: toNum(process.env.BENEFIT_MIN_AGE, 18),
};
