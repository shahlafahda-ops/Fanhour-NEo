import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getAnonymousSessionId } from '@/lib/identity/session';

export interface CurrentIdentity {
  anonymousSessionId: string | null;
  supporterId: string | null;
}

/**
 * Resolve BOTH identity handles for the current request.
 *
 * Reading by anonymous session alone is not enough: once a supporter verifies
 * by OTP their predictions are re-keyed to `supporter_id`, and a second device
 * carries a different anonymous session. Progress must follow the supporter,
 * otherwise XP and rank appear to reset after verification.
 */
export async function resolveCurrentIdentity(): Promise<CurrentIdentity> {
  const anonymousSessionId = getAnonymousSessionId();
  if (!hasSupabase() || !anonymousSessionId) {
    return { anonymousSessionId, supporterId: null };
  }
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('anonymous_session')
    .select('supporter_id')
    .eq('id', anonymousSessionId)
    .maybeSingle();
  return {
    anonymousSessionId,
    supporterId: (data?.supporter_id as string | undefined) ?? null,
  };
}

/** PostgREST `or=` filter matching either identity handle. */
export function identityOrFilter(identity: CurrentIdentity): string | null {
  const clauses: string[] = [];
  if (identity.supporterId) clauses.push(`supporter_id.eq.${identity.supporterId}`);
  if (identity.anonymousSessionId) {
    clauses.push(`anonymous_session_id.eq.${identity.anonymousSessionId}`);
  }
  return clauses.length ? clauses.join(',') : null;
}
