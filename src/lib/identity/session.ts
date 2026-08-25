import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';

const COOKIE = 'fh_sid';
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * First-party anonymous session identifier (prompt §12). This is a plain UUID
 * in a first-party cookie — NOT device fingerprinting. Value is delivered
 * before any identity request so the supporter gets value first.
 */
export function getAnonymousSessionId(): string | null {
  return cookies().get(COOKIE)?.value ?? null;
}

/** Read the anon session id or mint a new one (cookie set by the caller/route). */
export function ensureAnonymousCookieValue(): { id: string; isNew: boolean } {
  const existing = getAnonymousSessionId();
  if (existing) return { id: existing, isNew: false };
  return { id: randomUUID(), isNew: true };
}

export function anonymousCookieOptions() {
  return {
    name: COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  };
}

/** Persist the anonymous_session row (idempotent) and touch last_seen. */
export async function upsertAnonymousSession(id: string): Promise<void> {
  if (!hasSupabase()) return;
  const supabase = getAdminClient();
  await supabase
    .from('anonymous_session')
    .upsert({ id, last_seen_at: new Date().toISOString() }, { onConflict: 'id' });
}
