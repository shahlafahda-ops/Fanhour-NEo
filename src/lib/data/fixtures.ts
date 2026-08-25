import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { isTestDataAllowed } from '@/lib/config/env.server';
import type { FixtureStatus, FixtureResult, HomeAway } from '@/lib/domain/types';
import { effectiveFixtureStatus } from '@/lib/domain/fixture';

export interface FixtureRow {
  id: string;
  slug: string;
  opponentAr: string;
  competitionAr: string;
  hazemSide: HomeAway;
  venueAr: string | null;
  kickoffAt: string;
  predictionOpenAt: string;
  cutoffAt: string;
  status: FixtureStatus;
  hazemScore: number | null;
  opponentScore: number | null;
  result: FixtureResult | null;
  isTest: boolean;
}

function mapRow(r: Record<string, unknown>): FixtureRow {
  return {
    id: r.id as string,
    slug: r.slug as string,
    opponentAr: r.opponent_ar as string,
    competitionAr: r.competition_ar as string,
    hazemSide: r.hazem_side as HomeAway,
    venueAr: (r.venue_ar as string) ?? null,
    kickoffAt: r.kickoff_at as string,
    predictionOpenAt: r.prediction_open_at as string,
    cutoffAt: r.cutoff_at as string,
    status: r.status as FixtureStatus,
    hazemScore: (r.hazem_score as number) ?? null,
    opponentScore: (r.opponent_score as number) ?? null,
    result: (r.result as FixtureResult) ?? null,
    isTest: Boolean(r.is_test),
  };
}

/** In production, never surface test fixtures (prompt §45). */
function testFilter() {
  return isTestDataAllowed() ? undefined : false;
}

export function fixtureTimes(r: FixtureRow) {
  return {
    predictionOpenAt: new Date(r.predictionOpenAt),
    cutoffAt: new Date(r.cutoffAt),
    kickoffAt: new Date(r.kickoffAt),
  };
}

export function fixtureEffectiveStatus(r: FixtureRow, now = new Date()): FixtureStatus {
  return effectiveFixtureStatus(r.status, fixtureTimes(r), now);
}

/**
 * The "active" fixture the fan should land on: the soonest fixture that is open
 * or upcoming; falls back to the most recently resolved one so returning fans
 * see their result.
 */
export async function getActiveFixture(): Promise<FixtureRow | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  const testOnlyFalse = testFilter();

  let upcoming = supabase
    .from('fixture')
    .select('*')
    .in('status', ['scheduled', 'open', 'locked'])
    .order('kickoff_at', { ascending: true })
    .limit(1);
  if (testOnlyFalse === false) upcoming = upcoming.eq('is_test', false);
  const { data: up } = await upcoming;
  if (up && up.length > 0) return mapRow(up[0] as Record<string, unknown>);

  let recent = supabase
    .from('fixture')
    .select('*')
    .eq('status', 'resolved')
    .order('kickoff_at', { ascending: false })
    .limit(1);
  if (testOnlyFalse === false) recent = recent.eq('is_test', false);
  const { data: rec } = await recent;
  if (rec && rec.length > 0) return mapRow(rec[0] as Record<string, unknown>);

  return null;
}

export async function getFixtureBySlug(slug: string): Promise<FixtureRow | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  const { data } = await supabase.from('fixture').select('*').eq('slug', slug).maybeSingle();
  if (!data) return null;
  const row = mapRow(data as Record<string, unknown>);
  if (row.isTest && !isTestDataAllowed()) return null;
  return row;
}

export async function getNextFixtureAfter(kickoffAt: string): Promise<FixtureRow | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  let q = supabase
    .from('fixture')
    .select('*')
    .gt('kickoff_at', kickoffAt)
    .in('status', ['scheduled', 'open', 'locked'])
    .order('kickoff_at', { ascending: true })
    .limit(1);
  if (!isTestDataAllowed()) q = q.eq('is_test', false);
  const { data } = await q;
  if (data && data.length > 0) return mapRow(data[0] as Record<string, unknown>);
  return null;
}

/** Community counts from ACTUAL eligible predictions (prompt §10). */
export async function getCommunityCounts(fixtureId: string) {
  const empty = { hazem_win: 0, draw: 0, opponent_win: 0 };
  if (!hasSupabase()) return empty;
  const supabase = getAdminClient();
  const { data } = await supabase.from('prediction').select('outcome').eq('fixture_id', fixtureId);
  if (!data) return empty;
  const counts = { ...empty };
  for (const row of data as { outcome: keyof typeof counts }[]) {
    if (row.outcome in counts) counts[row.outcome] += 1;
  }
  return counts;
}
