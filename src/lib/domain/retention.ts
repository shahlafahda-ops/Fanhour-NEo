/**
 * Retention / behavioural metrics.
 *
 * The natural unit of engagement is a FIXTURE, not a day or a session.
 * A "Qualified Match Participation" (QMP) is a *distinct eligible fixture*
 * in which an identity completed the core prediction. Multiple predictions
 * (edits) on the same fixture still count once. Page views never count.
 *
 * See docs/ANALYTICS.md and prompt §38–§39, §69.
 */

/** A minimal record of a completed core prediction, for metric computation. */
export interface QualifiedParticipationInput {
  fixtureId: string;
}

/**
 * Distinct eligible fixtures the identity has a qualified prediction in.
 * This is the single primitive both QMP and MRAF derive from.
 */
export function distinctQualifiedFixtures(
  participations: readonly QualifiedParticipationInput[],
): Set<string> {
  const set = new Set<string>();
  for (const p of participations) set.add(p.fixtureId);
  return set;
}

/**
 * QMP = number of DISTINCT eligible fixtures with a qualified prediction.
 * Five predictions in the same fixture => QMP 1.
 */
export function computeQmp(participations: readonly QualifiedParticipationInput[]): number {
  return distinctQualifiedFixtures(participations).size;
}

/**
 * MRAF (Matchweek Returning Activated Fan): true once the identity has
 * completed the core prediction in TWO OR MORE distinct eligible fixtures.
 *
 * - Opening a page is not MRAF.
 * - Returning within the same fixture is not MRAF.
 * - Viewing the profile is not MRAF.
 * - A second distinct qualified fixture creates MRAF.
 */
export function isMraf(participations: readonly QualifiedParticipationInput[]): boolean {
  return computeQmp(participations) >= 2;
}

/** QMP depth buckets used on the ops dashboard (QMP-1/2/4/8). */
export type QmpBucket = 1 | 2 | 4 | 8;

export function qmpBucketsReached(
  participations: readonly QualifiedParticipationInput[],
): QmpBucket[] {
  const qmp = computeQmp(participations);
  return ([1, 2, 4, 8] as const).filter((b) => qmp >= b) as QmpBucket[];
}

/**
 * New vs returning for behavioural reporting. "Returning" is NOT defined by
 * the presence of localStorage — it requires at least one PRIOR distinct
 * qualified fixture participation before the fixture currently in context.
 */
export function classifyNewVsReturning(
  priorParticipations: readonly QualifiedParticipationInput[],
  currentFixtureId: string,
): 'new' | 'returning' {
  const priorDistinct = new Set<string>();
  for (const p of priorParticipations) {
    if (p.fixtureId !== currentFixtureId) priorDistinct.add(p.fixtureId);
  }
  return priorDistinct.size >= 1 ? 'returning' : 'new';
}

/** "شاركت في N من آخر M مباريات" — participation over the last M fixtures. */
export function participationOverRecentFixtures(
  participations: readonly QualifiedParticipationInput[],
  recentFixtureIdsNewestFirst: readonly string[],
): { participated: number; window: number } {
  const window = recentFixtureIdsNewestFirst.length;
  const done = distinctQualifiedFixtures(participations);
  let participated = 0;
  for (const fid of recentFixtureIdsNewestFirst) {
    if (done.has(fid)) participated += 1;
  }
  return { participated, window };
}
