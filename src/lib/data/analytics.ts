import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { computeQmp, isMraf } from '@/lib/domain/retention';
import { getFixtureTimeline } from '@/lib/data/fixtures';
import {
  computeXp, resolveRank, isExactScoreCorrect, parseProgressionConfig,
  type ProgressionConfig, type XpFixtureRecord,
} from '@/lib/domain/progression';
import { summarizeStreak, type FixtureStreakEntry } from '@/lib/domain/streak';
import { classifyLifecycle, type LifecycleState } from '@/lib/domain/lifecycle';
import type { ReactionKey } from '@/lib/domain/commentary';
import { getFlags } from '@/lib/data/flags';
import { summarizeMrafByArm, type ArmMrafSample, type ArmMrafSummary } from '@/lib/domain/reminder';

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
  // --- A1: matchweek reminders + randomised holdout ---
  reminderExperiment: Record<'treatment' | 'holdout', ArmMrafSummary>;
  reminderSubscribers: number;
  // --- A2: distribution accountability ---
  completionBySource: { source: string; views: number; predictions: number; completionRatePct: number | null }[];
  mrafBySource: { source: string; identities: number; mraf: number }[];
  touchpointsByFixture: {
    fixtureId: string; opponentAr: string; kickoffAt: string;
    planned: number; delivered: number; zeroDelivered: boolean;
  }[];
  // --- A3: honest eligibility funnel ---
  reachedCount: number;
  participatedCount: number;
  eligiblePopulation: number;
  claimRateOfEligiblePct: number | null;
  benefitBlockedByReason: { reason: string; count: number }[];
  // --- A5: cost model ---
  avgMinutesPerFixture: {
    questionSet: number | null; verification: number | null;
    resolution: number | null; sponsorReporting: number | null;
  };
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
  /** supporter_id if verified, else the anonymous_session_id. */
  identityKey: string;
  /** Acquisition source captured at first touch (A2); 'unknown' if never set. */
  source: string;
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
async function computeIdentityAggregates(
  progressionConfig: ProgressionConfig,
): Promise<IdentityAggregate[]> {
  const supabase = getAdminClient();
  const [{ data }, timeline, { data: sessionsRaw }] = await Promise.all([
    supabase
      .from('prediction')
      .select(
        'supporter_id, anonymous_session_id, fixture_id, is_correct, ' +
          'exact_hazem_score, exact_opponent_score',
      ),
    getFixtureTimeline(),
    supabase
      .from('anonymous_session')
      .select('id, supporter_id, source, first_seen_at')
      .order('first_seen_at', { ascending: true }),
  ]);

  const fixtureById = new Map(timeline.map((f) => [f.id, f]));
  const now = Date.now();

  // Source-by-identity: direct for anon-keyed identities; for a supporter,
  // the EARLIEST of their (possibly several, multi-device) sessions that
  // carries one — a best-effort "where this fan originally came from".
  const sessions = (sessionsRaw as
    | { id: string; supporter_id: string | null; source: string | null; first_seen_at: string }[]
    | null) ?? [];
  const sourceByIdentity = new Map<string, string>();
  for (const s of sessions) {
    if (s.source) sourceByIdentity.set(s.id, s.source);
  }
  for (const s of sessions) {
    if (s.supporter_id && s.source && !sourceByIdentity.has(s.supporter_id)) {
      sourceByIdentity.set(s.supporter_id, s.source);
    }
  }

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
  for (const [identityKey, records] of byIdentity.entries()) {
    const participated = new Set(records.map((r) => r.fixtureId));
    const streakTimeline: FixtureStreakEntry[] = timeline.map((f) => ({
      fixtureId: f.id,
      eligible: f.status !== 'cancelled',
      closed: now > new Date(f.cutoffAt).getTime() || f.status === 'resolved',
      participated: participated.has(f.id),
    }));
    const xp = computeXp(records, progressionConfig);
    const parts = records.map((r) => ({ fixtureId: r.fixtureId }));
    out.push({
      identityKey,
      source: sourceByIdentity.get(identityKey) ?? 'unknown',
      qmp: computeQmp(parts),
      mraf: isMraf(parts),
      xp,
      rankAr: resolveRank(xp, progressionConfig).rank.nameAr,
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

/**
 * A2: completion rate segmented by `?src=` acquisition source, captured on
 * `anonymous_session.source` at first touch. A view/prediction whose session
 * never got a source (pre-A2 fans, or a direct visit with no `?src=`) is
 * bucketed as 'unknown', not silently dropped.
 */
async function computeCompletionBySource(): Promise<
  { source: string; views: number; predictions: number; completionRatePct: number | null }[]
> {
  const supabase = getAdminClient();
  const [{ data: sessions }, { data: viewEvents }, { data: predEvents }] = await Promise.all([
    supabase.from('anonymous_session').select('id, source'),
    supabase.from('event').select('anonymous_session_id').eq('name', 'fixture_viewed'),
    supabase.from('event').select('anonymous_session_id').eq('name', 'prediction_submitted'),
  ]);
  const sourceById = new Map(
    ((sessions as { id: string; source: string | null }[]) ?? []).map((s) => [
      s.id,
      s.source ?? 'unknown',
    ]),
  );
  const bucket = (
    rows: { anonymous_session_id: string | null }[] | null,
  ): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.anonymous_session_id) continue;
      const src = sourceById.get(r.anonymous_session_id) ?? 'unknown';
      m.set(src, (m.get(src) ?? 0) + 1);
    }
    return m;
  };
  const views = bucket(viewEvents);
  const predictions = bucket(predEvents);
  const allSources = new Set([...views.keys(), ...predictions.keys()]);
  return [...allSources].map((source) => {
    const v = views.get(source) ?? 0;
    const p = predictions.get(source) ?? 0;
    return { source, views: v, predictions: p, completionRatePct: v > 0 ? Math.round((p / v) * 100) : null };
  });
}

/**
 * A2: planned vs delivered touchpoints per fixture, flagging any fixture that
 * ran with zero DELIVERED club touchpoints — the signal that separates a
 * product problem from "the club forgot to post".
 */
async function computeTouchpointsByFixture(): Promise<
  {
    fixtureId: string; opponentAr: string; kickoffAt: string;
    planned: number; delivered: number; zeroDelivered: boolean;
  }[]
> {
  const supabase = getAdminClient();
  const [{ data: fixtures }, { data: touchpoints }] = await Promise.all([
    supabase
      .from('fixture')
      .select('id, opponent_ar, kickoff_at')
      .order('kickoff_at', { ascending: false })
      .limit(30),
    supabase.from('distribution_touchpoint').select('fixture_id, status'),
  ]);
  const byFixture = new Map<string, { planned: number; delivered: number }>();
  for (const t of (touchpoints as { fixture_id: string | null; status: string }[]) ?? []) {
    if (!t.fixture_id) continue;
    const agg = byFixture.get(t.fixture_id) ?? { planned: 0, delivered: 0 };
    agg.planned += 1;
    if (t.status === 'delivered') agg.delivered += 1;
    byFixture.set(t.fixture_id, agg);
  }
  return ((fixtures as { id: string; opponent_ar: string; kickoff_at: string }[]) ?? []).map(
    (f) => {
      const agg = byFixture.get(f.id) ?? { planned: 0, delivered: 0 };
      return {
        fixtureId: f.id,
        opponentAr: f.opponent_ar,
        kickoffAt: f.kickoff_at,
        planned: agg.planned,
        delivered: agg.delivered,
        zeroDelivered: agg.planned > 0 && agg.delivered === 0,
      };
    },
  );
}

/**
 * A3: the honest commercial funnel — reached -> participated -> ELIGIBLE
 * POPULATION -> claimed -> redeemed, with the eligible population (not the
 * total) as the denominator for claim rate. Also tallies WHY ineligible
 * attempts were blocked, from `benefit_blocked` events.
 */
async function computeEligibilityFunnel(): Promise<{
  reachedCount: number;
  participatedCount: number;
  eligiblePopulation: number;
  claimRateOfEligiblePct: number | null;
  benefitBlockedByReason: { reason: string; count: number }[];
}> {
  const supabase = getAdminClient();
  const [reached, participated, { data: blockedRows }, benefitsIssued] = await Promise.all([
    countEvent('fixture_viewed'),
    countEvent('prediction_submitted'),
    supabase.from('event').select('props').eq('name', 'benefit_blocked'),
    countEvent('benefit_issued'),
  ]);

  const reasonCounts = new Map<string, number>();
  let eligibleAttempts = 0;
  for (const row of (blockedRows as { props: Record<string, unknown> | null }[]) ?? []) {
    const reason = row.props?.reason;
    if (typeof reason !== 'string') continue;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  // Eligible population = benefit-eligible fans we can actually observe: those
  // who claimed successfully (benefitsIssued) plus those who were blocked for
  // a reason OTHER than lacking eligibility in the first place. A supporter
  // blocked by 'no_participation'/'campaign_inactive' was never in the
  // eligible population to begin with.
  const ineligibleReasons = new Set(['no_participation', 'campaign_inactive']);
  for (const [reason, count] of reasonCounts) {
    if (!ineligibleReasons.has(reason)) eligibleAttempts += count;
  }
  const eligiblePopulation = benefitsIssued + eligibleAttempts;

  return {
    reachedCount: reached,
    participatedCount: participated,
    eligiblePopulation,
    claimRateOfEligiblePct:
      eligiblePopulation > 0 ? Math.round((benefitsIssued / eligiblePopulation) * 100) : null,
    benefitBlockedByReason: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** A5: measured per-fixture ops effort, replacing an assumed cost-model line. */
async function computeAvgMinutesPerFixture(): Promise<{
  questionSet: number | null; verification: number | null;
  resolution: number | null; sponsorReporting: number | null;
}> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('fixture')
    .select(
      'minutes_question_set, minutes_verification, minutes_resolution, minutes_sponsor_reporting',
    );
  const rows =
    (data as {
      minutes_question_set: number | null;
      minutes_verification: number | null;
      minutes_resolution: number | null;
      minutes_sponsor_reporting: number | null;
    }[]) ?? [];
  const avg = (values: (number | null)[]): number | null => {
    const present = values.filter((v): v is number => v !== null);
    return present.length > 0
      ? Math.round((present.reduce((a, v) => a + v, 0) / present.length) * 10) / 10
      : null;
  };
  return {
    questionSet: avg(rows.map((r) => r.minutes_question_set)),
    verification: avg(rows.map((r) => r.minutes_verification)),
    resolution: avg(rows.map((r) => r.minutes_resolution)),
    sponsorReporting: avg(rows.map((r) => r.minutes_sponsor_reporting)),
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  if (!hasSupabase()) return null;

  const flags = await getFlags();
  const progressionConfig = parseProgressionConfig(flags.progression_config.value);

  const [
    fixtureViews, predictionsStarted, predictionsSubmitted, benefitViews, claimsStarted,
    otpRequested, otpVerified, benefitsIssued, redemptionsValidated, redemptionFailed,
    supportRequests, activation1, activation2,
    identities, medianFirstPredictionSeconds, commentaryCounts, reminderRows,
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
    computeIdentityAggregates(progressionConfig),
    computeTimeToFirstValue(),
    computeCommentaryCounts(),
    getAdminClient().from('reminder_subscription').select('supporter_id, holdout_arm'),
  ]);

  // Retention depth from distinct qualified fixtures (QMP), never page views.
  const atLeast = (n: number) => identities.filter((i) => i.qmp >= n).length;
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null);

  const rankDistribution = progressionConfig.ranks.map((r) => ({
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

  // A1: MRAF for treatment vs holdout — intent-to-treat (every assigned
  // subscription counts, even one later withdrawn), which is what makes the
  // randomisation valid.
  const mrafByIdentityKey = new Map(identities.map((i) => [i.identityKey, i.mraf]));
  const reminderSubs =
    (reminderRows.data as { supporter_id: string; holdout_arm: 'treatment' | 'holdout' }[]) ?? [];
  const reminderExperiment = summarizeMrafByArm(
    reminderSubs.map((r) => ({
      arm: r.holdout_arm,
      isMraf: mrafByIdentityKey.get(r.supporter_id) ?? false,
    })),
  );

  // A2: completion + MRAF segmented by acquisition source.
  const sourceKeys = new Set(identities.map((i) => i.source));
  const mrafBySource = [...sourceKeys].map((source) => {
    const inSource = identities.filter((i) => i.source === source);
    return { source, identities: inSource.length, mraf: inSource.filter((i) => i.mraf).length };
  });

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
    reminderExperiment,
    reminderSubscribers: reminderSubs.length,
    completionBySource: await computeCompletionBySource(),
    mrafBySource,
    touchpointsByFixture: await computeTouchpointsByFixture(),
    ...(await computeEligibilityFunnel()),
    avgMinutesPerFixture: await computeAvgMinutesPerFixture(),
  };
}
