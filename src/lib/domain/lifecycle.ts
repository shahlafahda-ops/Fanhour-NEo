/**
 * Transparent, rule-based lifecycle segmentation (no churn model).
 *
 * These are INTERNAL Ops concepts. The names below must never be shown to
 * supporters — no fan-facing Arabic copy exists for them by design.
 */

import type { FixtureStreakEntry } from './streak';
import { computeCurrentStreak, participationInLastClosed } from './streak';

export type LifecycleState = 'NEW' | 'ACTIVATED' | 'ENGAGED' | 'POWER_FAN' | 'AT_RISK';

export const LIFECYCLE_RULES = {
  /** Participated in >= engagedOf of the last engagedWindow closed fixtures. */
  engagedOf: 2,
  engagedWindow: 3,
  /** Consecutive eligible fixtures required for POWER_FAN. */
  powerFanStreak: 4,
  /** Consecutive closed eligible fixtures missed to fall to AT_RISK. */
  atRiskMisses: 2,
} as const;

/** True if, at any point in history, the supporter met ENGAGED or POWER_FAN. */
function everReachedEngagement(timeline: readonly FixtureStreakEntry[]): boolean {
  const closed = timeline.filter((e) => e.eligible && e.closed);
  // Any window of `engagedWindow` with >= engagedOf participations.
  for (let i = 0; i + LIFECYCLE_RULES.engagedWindow <= closed.length; i += 1) {
    const win = closed.slice(i, i + LIFECYCLE_RULES.engagedWindow);
    if (win.filter((e) => e.participated).length >= LIFECYCLE_RULES.engagedOf) return true;
  }
  // Any run of >= powerFanStreak consecutive participations.
  let run = 0;
  for (const e of closed) {
    run = e.participated ? run + 1 : 0;
    if (run >= LIFECYCLE_RULES.powerFanStreak) return true;
  }
  return false;
}

/** Number of consecutive most-recent CLOSED eligible fixtures that were missed. */
function trailingMisses(timeline: readonly FixtureStreakEntry[]): number {
  const closed = timeline.filter((e) => e.eligible && e.closed);
  let misses = 0;
  for (let i = closed.length - 1; i >= 0; i -= 1) {
    if (closed[i]!.participated) break;
    misses += 1;
  }
  return misses;
}

/**
 * Classify a supporter. `timeline` is chronological (oldest first) and covers
 * the fixtures relevant to the pilot.
 */
export function classifyLifecycle(timeline: readonly FixtureStreakEntry[]): LifecycleState {
  const participatedAny = timeline.some((e) => e.eligible && e.participated);
  if (!participatedAny) return 'NEW';

  const misses = trailingMisses(timeline);
  if (misses >= LIFECYCLE_RULES.atRiskMisses && everReachedEngagement(timeline)) {
    return 'AT_RISK';
  }

  if (computeCurrentStreak(timeline) >= LIFECYCLE_RULES.powerFanStreak) return 'POWER_FAN';

  const recent = participationInLastClosed(timeline, LIFECYCLE_RULES.engagedWindow);
  if (recent.participated >= LIFECYCLE_RULES.engagedOf) return 'ENGAGED';

  return 'ACTIVATED';
}
