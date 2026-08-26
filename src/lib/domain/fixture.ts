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
