import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getFixtureBySlug, type FixtureRow } from '@/lib/data/fixtures';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRow(r: Record<string, unknown>): FixtureRow {
  return {
    id: r.id as string,
    slug: r.slug as string,
    opponentAr: r.opponent_ar as string,
    competitionAr: r.competition_ar as string,
    hazemSide: r.hazem_side as FixtureRow['hazemSide'],
    venueAr: (r.venue_ar as string) ?? null,
    kickoffAt: r.kickoff_at as string,
    predictionOpenAt: r.prediction_open_at as string,
    cutoffAt: r.cutoff_at as string,
    status: r.status as FixtureRow['status'],
    hazemScore: (r.hazem_score as number) ?? null,
    opponentScore: (r.opponent_score as number) ?? null,
    result: (r.result as FixtureRow['result']) ?? null,
    isTest: Boolean(r.is_test),
  };
}

export async function getFixtureBySlugOrId(idOrSlug: string): Promise<FixtureRow | null> {
  if (!UUID.test(idOrSlug)) return getFixtureBySlug(idOrSlug);
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  const { data } = await supabase.from('fixture').select('*').eq('id', idOrSlug).maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}
