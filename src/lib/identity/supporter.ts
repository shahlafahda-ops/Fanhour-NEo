import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getAnonymousSessionId } from '@/lib/identity/session';
import type { LocalitySegment } from '@/lib/domain/types';

export interface SupporterState {
  supporterId: string | null;
  isVerified: boolean;
  ageMeetsRequirement: boolean | null;
  locality: LocalitySegment;
}

/** Resolve the verified supporter behind the current anonymous session, if any. */
export async function getSupporterState(): Promise<SupporterState> {
  const none: SupporterState = {
    supporterId: null,
    isVerified: false,
    ageMeetsRequirement: null,
    locality: 'unknown',
  };
  if (!hasSupabase()) return none;
  const anonId = getAnonymousSessionId();
  if (!anonId) return none;
  const supabase = getAdminClient();
  const { data: sess } = await supabase
    .from('anonymous_session')
    .select('supporter_id')
    .eq('id', anonId)
    .maybeSingle();
  const supporterId = (sess?.supporter_id as string) ?? null;
  if (!supporterId) return none;
  const { data: sup } = await supabase
    .from('supporter')
    .select('is_verified, age_meets_requirement, locality')
    .eq('id', supporterId)
    .maybeSingle();
  if (!sup) return { ...none, supporterId };
  return {
    supporterId,
    isVerified: Boolean(sup.is_verified),
    ageMeetsRequirement: (sup.age_meets_requirement as boolean) ?? null,
    locality: (sup.locality as LocalitySegment) ?? 'unknown',
  };
}

/** Distinct qualified fixtures for a verified supporter (across devices). */
export async function getSupporterQualifiedFixtureIds(supporterId: string): Promise<string[]> {
  if (!hasSupabase()) return [];
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('prediction')
    .select('fixture_id')
    .eq('supporter_id', supporterId);
  if (!data) return [];
  return Array.from(new Set((data as { fixture_id: string }[]).map((r) => r.fixture_id)));
}
