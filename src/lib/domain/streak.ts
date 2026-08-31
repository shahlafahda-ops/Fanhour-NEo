/**
 * Fixture participation streaks — NOT daily streaks.
 *
 * A streak counts consecutive ELIGIBLE Al Hazem fixtures in which the supporter
 * completed a qualified core prediction. Rules:
 *  - A cancelled fixture is not eligible: it never breaks a streak.
 *  - A fixture where prediction was never available is not eligible either.
 *  - A fixture whose prediction window is still open is "pending": missing it
 *    does not break the streak yet (the supporter can still act).
 *  - A CLOSED eligible fixture with no prediction breaks the streak.
 */

export interface FixtureStreakEntry {
  fixtureId: string;
  /** False for cancelled fixtures or fixtures that never accepted predictions. */
  eligible: boolean;
  /** True once the prediction cutoff has passed (outcome of the window is final). */
  closed: boolean;
  /** True when the supporter has a qualified prediction on this fixture. */
  participated: boolean;
}

export interface StreakSummary {
  current: number;
  best: number;
  /** Distinct eligible fixtures participated in. */
  participated: number;
  /** Eligible fixtures whose window has closed. */
  eligibleClosed: number;
}

function eligibleOnly(t: readonly FixtureStreakEntry[]): FixtureStreakEntry[] {
  return t.filter((e) => e.eligible);
}

/**
 * Current streak, counted backwards from the most recent eligible fixture.
 * `timeline` must be chronological (oldest first).
 */
export function computeCurrentStreak(timeline: readonly FixtureStreakEntry[]): number {
  const list = eligibleOnly(timeline);
  let streak = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const e = list[i]!;
    if (e.participated) {
      streak += 1;
      continue;
    }
    // Not participated: a still-open fixture is pending, not a miss.
    if (!e.closed) continue;
    break;
  }
  return streak;
}

/** Longest run of consecutive eligible fixtures with a prediction. */
export function computeBestStreak(timeline: readonly FixtureStreakEntry[]): number {
  const list = eligibleOnly(timeline);
  let best = 0;
  let run = 0;
  for (const e of list) {
    if (e.participated) {
      run += 1;
      best = Math.max(best, run);
    } else if (e.closed) {
      run = 0;
    }
    // pending & unparticipated: neither extends nor resets
  }
  return best;
}

export function summarizeStreak(timeline: readonly FixtureStreakEntry[]): StreakSummary {
  const list = eligibleOnly(timeline);
  return {
    current: computeCurrentStreak(timeline),
    best: computeBestStreak(timeline),
    participated: list.filter((e) => e.participated).length,
    eligibleClosed: list.filter((e) => e.closed).length,
  };
}

/** Participation across the last N closed eligible fixtures. */
export function participationInLastClosed(
  timeline: readonly FixtureStreakEntry[],
  window: number,
): { participated: number; window: number } {
  const closed = eligibleOnly(timeline).filter((e) => e.closed);
  const slice = closed.slice(-window);
  return { participated: slice.filter((e) => e.participated).length, window: slice.length };
}
