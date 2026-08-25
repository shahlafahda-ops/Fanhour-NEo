import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getAnonymousSessionId } from '@/lib/identity/session';
import type { PredictionOutcome } from '@/lib/domain/types';

export interface RecordEntry {
  fixtureId: string;
  slug: string;
  opponentAr: string;
  kickoffAt: string;
  outcome: PredictionOutcome;
  isCorrect: boolean | null;
  status: string;
}

export interface SupporterRecord {
  entries: RecordEntry[];
  fixturesParticipated: number;
  gradedCount: number;
  correctCount: number;
  accuracyPct: number | null;
  firstParticipationAt: string | null;
}

/**
 * Factual, observable participation record (prompt §20). No wallet, no streaks,
 * no currency. QMP = distinct fixtures (enforced by the DB unique index).
 */
export async function getSupporterRecord(): Promise<SupporterRecord> {
  const empty: SupporterRecord = {
    entries: [],
    fixturesParticipated: 0,
    gradedCount: 0,
    correctCount: 0,
    accuracyPct: null,
    firstParticipationAt: null,
  };
  if (!hasSupabase()) return empty;
  const anonId = getAnonymousSessionId();
  if (!anonId) return empty;

  const supabase = getAdminClient();
  const { data } = await supabase
    .from('prediction')
    .select('outcome, is_correct, created_at, fixture:fixture_id ( id, slug, opponent_ar, kickoff_at, status )')
    .eq('anonymous_session_id', anonId)
    .order('created_at', { ascending: false });

  if (!data) return empty;

  const entries: RecordEntry[] = [];
  let correct = 0;
  let graded = 0;
  let firstAt: string | null = null;

  for (const row of data as unknown as {
    outcome: PredictionOutcome;
    is_correct: boolean | null;
    created_at: string;
    fixture: {
      id: string;
      slug: string;
      opponent_ar: string;
      kickoff_at: string;
      status: string;
    } | null;
  }[]) {
    if (!row.fixture) continue;
    entries.push({
      fixtureId: row.fixture.id,
      slug: row.fixture.slug,
      opponentAr: row.fixture.opponent_ar,
      kickoffAt: row.fixture.kickoff_at,
      outcome: row.outcome,
      isCorrect: row.is_correct,
      status: row.fixture.status,
    });
    if (row.is_correct !== null) {
      graded += 1;
      if (row.is_correct) correct += 1;
    }
    if (!firstAt || row.created_at < firstAt) firstAt = row.created_at;
  }

  return {
    entries,
    fixturesParticipated: entries.length,
    gradedCount: graded,
    correctCount: correct,
    accuracyPct: graded > 0 ? Math.round((correct / graded) * 100) : null,
    firstParticipationAt: firstAt,
  };
}
