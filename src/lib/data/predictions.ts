import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import type { PredictionOutcome } from '@/lib/domain/types';
import { getAnonymousSessionId } from '@/lib/identity/session';

/** The current identity's prediction for a fixture (by anon session cookie). */
export async function getMyPrediction(fixtureId: string): Promise<{
  outcome: PredictionOutcome;
  exactHazemScore: number | null;
  exactOpponentScore: number | null;
  isCorrect: boolean | null;
} | null> {
  if (!hasSupabase()) return null;
  const anonId = getAnonymousSessionId();
  if (!anonId) return null;
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('prediction')
    .select('outcome, exact_hazem_score, exact_opponent_score, is_correct')
    .eq('fixture_id', fixtureId)
    .eq('anonymous_session_id', anonId)
    .maybeSingle();
  if (!data) return null;
  return {
    outcome: data.outcome as PredictionOutcome,
    exactHazemScore: (data.exact_hazem_score as number) ?? null,
    exactOpponentScore: (data.exact_opponent_score as number) ?? null,
    isCorrect: (data.is_correct as boolean) ?? null,
  };
}

/** All qualified fixtures the current anon identity has participated in. */
export async function getMyQualifiedFixtureIds(): Promise<string[]> {
  if (!hasSupabase()) return [];
  const anonId = getAnonymousSessionId();
  if (!anonId) return [];
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('prediction')
    .select('fixture_id')
    .eq('anonymous_session_id', anonId);
  if (!data) return [];
  return Array.from(new Set((data as { fixture_id: string }[]).map((r) => r.fixture_id)));
}
