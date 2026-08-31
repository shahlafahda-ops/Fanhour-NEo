import type {
  FixtureResult,
  FixtureStatus,
  FixtureTimes,
  HomeAway,
  PredictionOutcome,
} from './types';

export const RIYADH_TZ = 'Asia/Riyadh';

/**
 * Compute the *effective* status of a fixture from server time and configured
 * windows. The stored status can lead (ops may lock/resolve manually) but the
 * client clock must NEVER decide eligibility — always call this on the server
 * with `now = new Date()`.
 *
 * Precedence: a terminal stored status (resolved/cancelled) always wins.
 * Otherwise the time windows determine open/locked/scheduled.
 */
export function effectiveFixtureStatus(
  storedStatus: FixtureStatus,
  times: FixtureTimes,
  now: Date,
): FixtureStatus {
  if (storedStatus === 'resolved' || storedStatus === 'cancelled') {
    return storedStatus;
  }
  const t = now.getTime();
  if (t < times.predictionOpenAt.getTime()) return 'scheduled';
  if (t < times.cutoffAt.getTime()) return 'open';
  return 'locked';
}

/** Whether a new prediction can be created or an existing one modified. */
export function isPredictionEditable(
  storedStatus: FixtureStatus,
  times: FixtureTimes,
  now: Date,
): boolean {
  return effectiveFixtureStatus(storedStatus, times, now) === 'open';
}

/**
 * Translate raw scores into a fixture result from Al Hazem's perspective.
 * `homeAway` says which side Al Hazem played so callers can pass scores in a
 * consistent (hazem, opponent) order regardless of venue.
 */
export function resultFromScores(hazemScore: number, opponentScore: number): FixtureResult {
  if (!Number.isInteger(hazemScore) || !Number.isInteger(opponentScore)) {
    throw new Error('Scores must be integers');
  }
  if (hazemScore < 0 || opponentScore < 0) {
    throw new Error('Scores must be non-negative');
  }
  if (hazemScore > opponentScore) return 'hazem_win';
  if (hazemScore < opponentScore) return 'opponent_win';
  return 'draw';
}

/**
 * Convenience: given scores recorded as (home, away) plus which side Al Hazem
 * is, normalise to (hazem, opponent) then compute the result.
 */
export function resultFromVenueScores(
  homeScore: number,
  awayScore: number,
  hazemSide: HomeAway,
): FixtureResult {
  const [hazem, opponent] =
    hazemSide === 'home' ? [homeScore, awayScore] : [awayScore, homeScore];
  return resultFromScores(hazem, opponent);
}

/** Whether a prediction's outcome matches the resolved result. */
export function isPredictionCorrect(
  outcome: PredictionOutcome,
  result: FixtureResult,
): boolean {
  return outcome === result;
}

/**
 * Choose which fixture a supporter should land on, from a candidate set whose
 * stored status is scheduled/open/locked (not yet resolved).
 *
 * BUG THIS FIXES: selecting purely by "soonest kickoff_at among non-resolved
 * fixtures" lets a STALE fixture — one whose real-time window has already
 * elapsed but that ops never resolved or cancelled (e.g. leftover test data) —
 * permanently bury every genuinely upcoming fixture, because it has an earlier
 * kickoff and its stored status was never updated.
 *
 * Correct priority, using the TIME-DERIVED effective status, not the stored one:
 *   1. The soonest fixture that is effectively OPEN (predictions live).
 *   2. If none, the MOST RECENT fixture that is effectively LOCKED (in
 *      progress / awaiting resolution) — the current match, not an old one.
 *   3. If none, the soonest fixture that is effectively SCHEDULED (upcoming).
 *   4. Otherwise null (caller falls back to the most recently resolved fixture).
 */
export function selectActiveFixture<T extends { status: FixtureStatus }>(
  candidates: readonly T[],
  times: (row: T) => FixtureTimes,
  now: Date,
): T | null {
  const withStatus = candidates.map((row) => ({
    row,
    effective: effectiveFixtureStatus(row.status, times(row), now),
    kickoffAt: times(row).kickoffAt.getTime(),
  }));

  const open = withStatus.filter((c) => c.effective === 'open');
  if (open.length > 0) {
    return open.reduce((soonest, c) => (c.kickoffAt < soonest.kickoffAt ? c : soonest)).row;
  }

  const locked = withStatus.filter((c) => c.effective === 'locked');
  if (locked.length > 0) {
    return locked.reduce((latest, c) => (c.kickoffAt > latest.kickoffAt ? c : latest)).row;
  }

  const scheduled = withStatus.filter((c) => c.effective === 'scheduled');
  if (scheduled.length > 0) {
    return scheduled.reduce((soonest, c) => (c.kickoffAt < soonest.kickoffAt ? c : soonest)).row;
  }

  return null;
}
