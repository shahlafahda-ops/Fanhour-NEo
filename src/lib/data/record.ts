import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { resolveCurrentIdentity, identityOrFilter } from '@/lib/identity/current';
import { getFixtureTimeline } from '@/lib/data/fixtures';
import type { PredictionOutcome } from '@/lib/domain/types';
import {
  computeXp, resolveRank, isExactScoreCorrect, computeAccuracyPct,
  xpForFixture, parseProgressionConfig, type RankProgress, type XpFixtureRecord,
} from '@/lib/domain/progression';
import { summarizeStreak, type FixtureStreakEntry, type StreakSummary } from '@/lib/domain/streak';
import { classifyLifecycle, type LifecycleState } from '@/lib/domain/lifecycle';
import { getFlags } from '@/lib/data/flags';

export interface RecordEntry {
  fixtureId: string;
  slug: string;
  opponentAr: string;
  kickoffAt: string;
  outcome: PredictionOutcome;
  isCorrect: boolean | null;
  status: string;
  /** Final score, once resolved. */
  hazemScore: number | null;
  opponentScore: number | null;
  /** The supporter's optional exact-score call. */
  predictedHazem: number | null;
  predictedOpponent: number | null;
  isExactCorrect: boolean;
  xpEarned: number;
}

export interface SupporterRecord {
  entries: RecordEntry[];
  fixturesParticipated: number;
  gradedCount: number;
  correctCount: number;
  exactCount: number;
  accuracyPct: number | null;
  firstParticipationAt: string | null;
  /** Status layer — derived, never persisted. */
  xp: number;
  progress: RankProgress;
  streak: StreakSummary;
  /** Internal Ops concept — never rendered to supporters. */
  lifecycle: LifecycleState;
}

const EMPTY: SupporterRecord = {
  entries: [],
  fixturesParticipated: 0,
  gradedCount: 0,
  correctCount: 0,
  exactCount: 0,
  accuracyPct: null,
  firstParticipationAt: null,
  xp: 0,
  progress: resolveRank(0),
  streak: { current: 0, best: 0, participated: 0, eligibleClosed: 0 },
  lifecycle: 'NEW',
};

interface PredictionJoinRow {
  outcome: PredictionOutcome;
  is_correct: boolean | null;
  exact_hazem_score: number | null;
  exact_opponent_score: number | null;
  created_at: string;
  fixture: {
    id: string;
    slug: string;
    opponent_ar: string;
    kickoff_at: string;
    status: string;
    hazem_score: number | null;
    opponent_score: number | null;
  } | null;
}

/**
 * Factual participation record plus the derived status layer.
 *
 * Everything here (XP, rank, streak, lifecycle, exact-score correctness) is
 * recomputed from authoritative `prediction` + `fixture` rows, so an ops score
 * correction or an identity merge heals automatically.
 */
export async function getSupporterRecord(): Promise<SupporterRecord> {
  if (!hasSupabase()) return EMPTY;
  const identity = await resolveCurrentIdentity();
  const filter = identityOrFilter(identity);
  if (!filter) return EMPTY;

  const flags = await getFlags();
  const progressionConfig = parseProgressionConfig(flags.progression_config.value);

  const supabase = getAdminClient();
  const { data } = await supabase
    .from('prediction')
    .select(
      'outcome, is_correct, exact_hazem_score, exact_opponent_score, created_at, ' +
        'fixture:fixture_id ( id, slug, opponent_ar, kickoff_at, status, hazem_score, opponent_score )',
    )
    .or(filter)
    .order('created_at', { ascending: false });

  const rows = (data as unknown as PredictionJoinRow[]) ?? [];

  const entries: RecordEntry[] = [];
  const xpRecords: XpFixtureRecord[] = [];
  const seenFixtures = new Set<string>();
  let correct = 0;
  let graded = 0;
  let exact = 0;
  let firstAt: string | null = null;

  for (const row of rows) {
    if (!row.fixture) continue;
    // One qualified participation per fixture (the DB enforces this, but a
    // merged supporter could momentarily surface both handles).
    if (seenFixtures.has(row.fixture.id)) continue;
    seenFixtures.add(row.fixture.id);

    const isExactCorrect = isExactScoreCorrect(
      { hazem: row.exact_hazem_score, opponent: row.exact_opponent_score },
      { hazem: row.fixture.hazem_score, opponent: row.fixture.opponent_score },
    );
    const xpRec: XpFixtureRecord = {
      fixtureId: row.fixture.id,
      isCorrect: row.is_correct,
      isExactCorrect,
    };
    xpRecords.push(xpRec);

    entries.push({
      fixtureId: row.fixture.id,
      slug: row.fixture.slug,
      opponentAr: row.fixture.opponent_ar,
      kickoffAt: row.fixture.kickoff_at,
      outcome: row.outcome,
      isCorrect: row.is_correct,
      status: row.fixture.status,
      hazemScore: row.fixture.hazem_score,
      opponentScore: row.fixture.opponent_score,
      predictedHazem: row.exact_hazem_score,
      predictedOpponent: row.exact_opponent_score,
      isExactCorrect,
      xpEarned: xpForFixture(xpRec, progressionConfig),
    });

    if (row.is_correct !== null) {
      graded += 1;
      if (row.is_correct) correct += 1;
    }
    if (isExactCorrect) exact += 1;
    if (!firstAt || row.created_at < firstAt) firstAt = row.created_at;
  }

  // Streak / lifecycle need the full fixture timeline, not only participations.
  const timeline = await getFixtureTimeline();
  const now = Date.now();
  const streakTimeline: FixtureStreakEntry[] = timeline.map((f) => ({
    fixtureId: f.id,
    eligible: f.status !== 'cancelled',
    closed: now > new Date(f.cutoffAt).getTime() || f.status === 'resolved',
    participated: seenFixtures.has(f.id),
  }));

  const xp = computeXp(xpRecords, progressionConfig);

  return {
    entries,
    fixturesParticipated: seenFixtures.size,
    gradedCount: graded,
    correctCount: correct,
    exactCount: exact,
    accuracyPct: computeAccuracyPct(xpRecords),
    firstParticipationAt: firstAt,
    xp,
    progress: resolveRank(xp, progressionConfig),
    streak: summarizeStreak(streakTimeline),
    lifecycle: classifyLifecycle(streakTimeline),
  };
}
