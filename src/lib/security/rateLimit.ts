import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Fixed-window rate limiter backed by the `rate_limit` table. Concurrency-safe
 * enough for pilot scale via an atomic upsert-then-increment. Used to protect
 * OTP request, OTP verify, and fallback-code redemption endpoints (prompt §51).
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const supabase = getAdminClient();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);

  // Atomic increment via RPC-less upsert: insert row for window, then increment.
  const { data, error } = await supabase
    .rpc('increment_rate_limit', { p_bucket: bucket, p_window_start: windowStart.toISOString() })
    .single<{ count: number }>();

  if (error) {
    // Fail closed on OTP-class buckets is safer, but to avoid locking users out
    // on a transient DB hiccup we fail open here and rely on other controls.
    // eslint-disable-next-line no-console
    console.error('[rateLimit] error', error.message);
    return { allowed: true, count: 0 };
  }
  const count = data?.count ?? 1;
  return { allowed: count <= limit, count };
}
