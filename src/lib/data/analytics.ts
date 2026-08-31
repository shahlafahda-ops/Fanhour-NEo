import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { computeQmp, isMraf } from '@/lib/domain/retention';
import { getFixtureTimeline } from '@/lib/data/fixtures';
import {
  computeXp, resolveRank, isExactScoreCorrect, RANKS, type XpFixtureRecord,
} from '@/lib/domain/progression';
import { summarizeStreak, type FixtureStreakEntry } from '@/lib/domain/streak';
import { classifyLifecycle, type LifecycleState } from '@/lib/domain/lifecycle';
import type { ReactionKey } from '@/lib/domain/commentary';

export interface DashboardMetrics {
  // Acquisition / activation
  fixtureViews: number;
  predictionsStarted: number;
  predictionsSubmitted: number;
  completionRatePct: number | null;
  // Retention
  mrafCount: number;
  qmp1: number;
  qmp2: number;
  qmp4: number;
  qmp8: number;
  // Commercial funnel
  benefitViews: number;
  claimsStarted: number;
  otpRequested: number;
  otpVerified: number;
  benefitsIssued: number;
  redemptionsValidated: number;
  claimToRedemptionPct: number | null;
  // Fulfilment
  redemptionFailed: number;
  supportRequests: number;
  // --- Pilot 1 retention / status layer ---
  /** Activation 1: first qualified prediction. */
  activation1: number;
  /** Activation 2: returned after resolution and saw their outcome. */
  activation2: number;
  /** Median seconds from first fixture view to first qualified prediction. */
  medianFirstPredictionSeconds: number | null;
  /** Fixture-to-fixture depth. */
  f1ToF2Pct: number | null;
  f2ToF3Pct: number | null;
  f3ToF4Pct: number | null;
  /** Rank distribution keyed by the approved Arabic names. */
  rankDistribution: { nameAr: string; count: number }[];
  averageXp: number | null;
  exactScoreSuccesses: number;
  /** Current-streak distribution: streak depth -> supporters. */
  streakDistribution: { depth: number; count: number }[];
  lifecycle: Record<LifecycleState, number>;
  /** Diagnostic only — is the commentary engine firing sensibly? */
  commentaryCounts: { reactionKey: string; phraseAr: string; count: number }[];
}

async function countEvent(name: string): Promise<number> {
  const supabase = getAdminClient();
  const { count } = await supabase
    .from('event')
    .select('*', { count: 'exact', head: true })
    .eq('name', name);
  return count ?? 0;
}

/**
 * Retention is computed from the PREDICTION table (the authoritative qualified
 * participation), not from page-view events — QMP/MRAF count distinct fixtures
 * per identity (prompt §38, §39, §43).
 */
interface IdentityAggregate {
  qmp: number;
  mraf: boolean;
  xp: number;
  rankAr: string;
  currentStreak: number;
  lifecycle: LifecycleState;
  exactHits: number;
}

/**
 * Single pass over predictions, grouped by identity. Retention, XP, rank,
 * streak and lifecycle are all DERIVED here from authoritative rows — nothing
 * about the status layer is persisted.
 */
async function computeIdentityAggregates(): Promise<IdentityAggregate[]> {
  const supabase = getAdminClient();
  const [{ data }, timeline] = await Promise.all([
    supabase
      .from('prediction')
      .select(
        'supporter_id, anonymous_session_id, fixture_id, is_correct, ' +
          'exact_hazem_score, exact_opponent_score',
      ),
    getFixtureTimeline(),
  ]);

  const fixtureById = new Map(timeline.map((f) => [f.id, f]));
  const now = Date.now();

  const byIdentity = new Map<string, XpFixtureRecord[]>();
  for (const row of (data as unknown as {
    supporter_id: string | null;
    anonymous_session_id: string | null;
    fixture_id: string;
    is_correct: boolean | null;
    exact_hazem_score: number | null;
    exact_opponent_score: number | null;
  }[]) ?? []) {
    const key = row.supporter_id ?? row.anonymous_session_id;
    if (!key) continue;
    const fx = fixtureById.get(row.fixture_id);
    const isExactCorrect = fx
      ? isExactScoreCorrect(
          { hazem: row.exact_hazem_score, opponent: row.exact_opponent_score },
          { hazem: fx.hazemScore, opponent: fx.opponentScore },
        )
      : false;
    const list = byIdentity.get(key) ?? [];
    if (!list.some((r) => r.fixtureId === row.fixture_id)) {
      list.push({ fixtureId: row.fixture_id, isCorrect: row.is_correct, isExactCorrect });
    }
    byIdentity.set(key, list);
  }

  const out: IdentityAggregate[] = [];
  for (const records of byIdentity.values()) {
    const participated = new Set(records.map((r) => r.fixtureId));
    const streakTimeline: FixtureStreakEntry[] = timeline.map((f) => ({
      fixtureId: f.id,
      eligible: f.status !== 'cancelled',
      closed: now > new Date(f.cutoffAt).getTime() || f.status === 'resolved',
      participated: participated.has(f.id),
    }));
    const xp = computeXp(records);
    const parts = records.map((r) => ({ fixtureId: r.fixtureId }));
    out.push({
      qmp: computeQmp(parts),
      mraf: isMraf(parts),
      xp,
      rankAr: resolveRank(xp).rank.nameAr,
      currentStreak: summarizeStreak(streakTimeline).current,
      lifecycle: classifyLifecycle(streakTimeline),
      exactHits: records.filter((r) => r.isExactCorrect).length,
    });
  }
  return out;
}

/** Median of a numeric list; null when empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/**
 * Median seconds from a supporter's first fixture view to their first qualified
 * prediction. Both timestamps are recorded server-side, so this is trustworthy
 * (client-only timing would not be).
 */
async function computeTimeToFirstValue(): Promise<number | null> {
  const supabase = getAdminClient();
  const [{ data: views }, { data: firsts }] = await Promise.all([
    supabase
      .from('event')
      .select('anonymous_session_id, created_at')
      .eq('name', 'fixture_viewed')
      .order('created_at', { ascending: true }),
    supabase
      .from('event')
      .select('anonymous_session_id, created_at')
      .eq('name', 'first_value_reached'),
  ]);

  const firstView = new Map<string, number>();
  for (const v of (views as { anonymous_session_id: string | null; created_at: string }[]) ?? []) {
    if (!v.anonymous_session_id) continue;
    if (!firstView.has(v.anonymous_session_id)) {
      firstView.set(v.anonymous_session_id, new Date(v.created_at).getTime());
    }
  }

  const deltas: number[] = [];
  for (const f of (firsts as { anonymous_session_id: string | null; created_at: string }[]) ?? []) {
    if (!f.anonymous_session_id) continue;
    const viewedAt = firstView.get(f.anonymous_session_id);
    if (viewedAt === undefined) continue;
    const delta = (new Date(f.created_at).getTime() - viewedAt) / 1000;
    if (delta >= 0 && delta < 60 * 60) deltas.push(delta); // ignore stale sessions
  }
  return median(deltas);
}

/** Commentary diagnostics: how often each phrase actually fired. */
async function computeCommentaryCounts(): Promise<
  { reactionKey: string; phraseAr: string; count: number }[]
> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('event')
    .select('props')
    .eq('name', 'commentary_reaction_shown');

  const counts = new Map<string, number>();
  for (const row of (data as { props: Record<string, unknown> | null }[]) ?? []) {
    const key = row.props?.reaction_key;
    if (typeof key !== 'string') continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const PHRASES: Record<string, string> = {
    BEL_MILLIMETER: 'بالمليمتر يا حبيبي!',
    YA_RABAAH: 'يا رباه!',
    AYNI_AYNI: 'عيني عيني!',
    YWAZZAA: 'يوززززززع!',
    KNOCKOUT_POSSIBLE: 'الضربة القاضية ممكن!',
  };
  return [...counts.entries()]
    .map(([reactionKey, count]) => ({
      reactionKey,
      phraseAr: PHRASES[reactionKey] ?? reactionKey,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  if (!hasSupabase()) return null;

  const [
    fixtureViews, predictionsStarted, predictionsSubmitted, benefitViews, claimsStarted,
    otpRequested, otpVerified, benefitsIssued, redemptionsValidated, redemptionFailed,
    supportRequests, activation1, activation2,
    identities, medianFirstPredictionSeconds, commentaryCounts,
  ] = await Promise.all([
    countEvent('fixture_viewed'),
    countEvent('prediction_started'),
    countEvent('prediction_submitted'),
    countEvent('benefit_viewed'),
    countEvent('claim_started'),
    countEvent('otp_requested'),
    countEvent('otp_verified'),
    countEvent('benefit_issued'),
    countEvent('redemption_validated'),
    countEvent('redemption_failed'),
    countEvent('support_requested'),
    countEvent('first_value_reached'),
    countEvent('first_resolution_viewed'),
    computeIdentityAggregates(),
    computeTimeToFirstValue(),
    computeCommentaryCounts(),
  ]);

  // Retention depth from distinct qualified fixtures (QMP), never page views.
  const atLeast = (n: number) => identities.filter((i) => i.qmp >= n).length;
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

  const rankDistribution = RANKS.map((r) => ({
    nameAr: r.nameAr,
    count: identities.filter((i) => i.rankAr === r.nameAr).length,
  }));

  const streakBuckets = new Map<number, number>();
  for (const i of identities) {
    if (i.currentStreak <= 0) continue;
    streakBuckets.set(i.currentStreak, (streakBuckets.get(i.currentStreak) ?? 0) + 1);
  }

  const lifecycle: Record<LifecycleState, number> = {
    NEW: 0, ACTIVATED: 0, ENGAGED: 0, POWER_FAN: 0, AT_RISK: 0,
  };
  for (const i of identities) lifecycle[i.lifecycle] += 1;

  return {
    fixtureViews,
    predictionsStarted,
    predictionsSubmitted,
    completionRatePct: pct(predictionsSubmitted, predictionsStarted),
    mrafCount: identities.filter((i) => i.mraf).length,
    qmp1: atLeast(1),
    qmp2: atLeast(2),
    qmp4: atLeast(4),
    qmp8: atLeast(8),
    benefitViews,
    claimsStarted,
    otpRequested,
    otpVerified,
    benefitsIssued,
    redemptionsValidated,
    claimToRedemptionPct: pct(redemptionsValidated, benefitsIssued),
    redemptionFailed,
    supportRequests,
    activation1,
    activation2,
    medianFirstPredictionSeconds,
    f1ToF2Pct: pct(atLeast(2), atLeast(1)),
    f2ToF3Pct: pct(atLeast(3), atLeast(2)),
    f3ToF4Pct: pct(atLeast(4), atLeast(3)),
    rankDistribution,
    averageXp:
      identities.length > 0
        ? Math.round(identities.reduce((a, i) => a + i.xp, 0) / identities.length)
        : null,
    exactScoreSuccesses: identities.reduce((a, i) => a + i.exactHits, 0),
    streakDistribution: [...streakBuckets.entries()]
      .map(([depth, count]) => ({ depth, count }))
      .sort((a, b) => a.depth - b.depth),
    lifecycle,
    commentaryCounts,
  };
}
