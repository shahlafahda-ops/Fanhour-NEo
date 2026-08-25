import type { PredictionOutcome } from './types';

/**
 * Community distribution shown immediately after a prediction is submitted.
 *
 * Honesty rules (prompt §10):
 *  - percentages come only from ACTUAL eligible predictions;
 *  - below COMMUNITY_MIN_SAMPLE we show neutral copy, never fabricated counts;
 *  - we never imply the fan's prediction is correct before the match ends.
 */

export interface CommunityCounts {
  hazem_win: number;
  draw: number;
  opponent_win: number;
}

export interface CommunityDistribution {
  hasEnoughSample: boolean;
  total: number;
  /** Integer percentages summing to 100 (largest-remainder rounding). Null below threshold. */
  percentages: Record<PredictionOutcome, number> | null;
}

export function computeCommunityDistribution(
  counts: CommunityCounts,
  minSample: number,
): CommunityDistribution {
  const total = counts.hazem_win + counts.draw + counts.opponent_win;
  if (total < minSample) {
    return { hasEnoughSample: false, total, percentages: null };
  }

  const raw: Record<PredictionOutcome, number> = {
    hazem_win: (counts.hazem_win / total) * 100,
    draw: (counts.draw / total) * 100,
    opponent_win: (counts.opponent_win / total) * 100,
  };

  // Largest-remainder method so the three integers sum to exactly 100.
  const floors = {
    hazem_win: Math.floor(raw.hazem_win),
    draw: Math.floor(raw.draw),
    opponent_win: Math.floor(raw.opponent_win),
  } as Record<PredictionOutcome, number>;
  let remainder = 100 - (floors.hazem_win + floors.draw + floors.opponent_win);
  const order = (Object.keys(raw) as PredictionOutcome[]).sort(
    (a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a])),
  );
  const percentages = { ...floors };
  for (const key of order) {
    if (remainder <= 0) break;
    percentages[key] += 1;
    remainder -= 1;
  }

  return { hasEnoughSample: true, total, percentages };
}
