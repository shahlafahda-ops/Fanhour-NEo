/**
 * FanHour Supporter Status & Progression (Pilot 1).
 *
 * XP is NOT a currency: it has no monetary value, cannot be bought, redeemed,
 * transferred, and MUST NOT influence sponsor-benefit eligibility. It exists to
 * express football participation and prediction skill.
 *
 * XP is never persisted — it is recomputed from the authoritative `prediction`
 * and `fixture` rows so an ops score correction or an identity merge is
 * self-healing (see docs/DATA_MODEL.md).
 */

/** Single place to tune the Pilot 1 XP economy. */
export const XP_VALUES = {
  /** One qualified core prediction in a DISTINCT eligible fixture. */
  participation: 10,
  /** Correct match outcome (1X2). */
  correctOutcome: 20,
  /** Correct exact score — awarded IN ADDITION to correctOutcome. */
  exactScore: 20,
} as const;

/** Maximum XP obtainable from a single fixture. */
export const MAX_XP_PER_FIXTURE =
  XP_VALUES.participation + XP_VALUES.correctOutcome + XP_VALUES.exactScore;

export type RankKey = 'motaabi' | 'moshaje' | 'mohalil_khabeer' | 'mohalil_mokhadram' | 'ustoora';

export interface Rank {
  key: RankKey;
  /** Exact approved Arabic name — do not translate or replace. */
  nameAr: string;
  minXp: number;
}

/**
 * Pilot 1 thresholds, calibrated against ~11–12 usable fixtures in the 90-day
 * window (max 50 XP/fixture => 550–600 theoretical).
 *
 * Deliberate property: participation alone caps a supporter at مشجع
 * (12 fixtures x 10 XP = 120 < 150). محلل خبير and above must be earned with
 * prediction accuracy, so the ladder reads as football credibility.
 *
 * Rebalance lever: if usable fixtures fall below 11, lower `ustoora` to ~32 x N.
 */
export const RANKS: readonly Rank[] = [
  { key: 'motaabi', nameAr: 'متابع', minXp: 0 },
  { key: 'moshaje', nameAr: 'مشجع', minXp: 60 },
  { key: 'mohalil_khabeer', nameAr: 'محلل خبير', minXp: 150 },
  { key: 'mohalil_mokhadram', nameAr: 'محلل مخضرم', minXp: 260 },
  { key: 'ustoora', nameAr: 'أسطورة', minXp: 380 },
] as const;

/** One graded (or pending) fixture participation, for XP computation. */
export interface XpFixtureRecord {
  fixtureId: string;
  /** Outcome correctness; null while the fixture is unresolved. */
  isCorrect: boolean | null;
  /** Exact-score correctness (derived, never stored). */
  isExactCorrect: boolean;
}

/**
 * Derive exact-score correctness. Requires BOTH predicted scores and BOTH final
 * scores; a supporter who skipped the optional depth question is never exact.
 */
export function isExactScoreCorrect(
  predicted: { hazem: number | null; opponent: number | null },
  final: { hazem: number | null; opponent: number | null },
): boolean {
  if (predicted.hazem === null || predicted.opponent === null) return false;
  if (final.hazem === null || final.opponent === null) return false;
  return predicted.hazem === final.hazem && predicted.opponent === final.opponent;
}

/** XP for a single fixture participation. */
export function xpForFixture(rec: XpFixtureRecord): number {
  let xp = XP_VALUES.participation;
  if (rec.isCorrect === true) xp += XP_VALUES.correctOutcome;
  // Exact score only counts alongside a correct outcome — an exact score that
  // contradicts the outcome is impossible, so this is a defensive guard.
  if (rec.isCorrect === true && rec.isExactCorrect) xp += XP_VALUES.exactScore;
  return xp;
}

/** Total XP across DISTINCT fixtures (duplicate fixture rows are ignored). */
export function computeXp(records: readonly XpFixtureRecord[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const r of records) {
    if (seen.has(r.fixtureId)) continue;
    seen.add(r.fixtureId);
    total += xpForFixture(r);
  }
  return total;
}

export interface RankProgress {
  rank: Rank;
  xp: number;
  /** Null once the supporter holds the highest rank. */
  nextRank: Rank | null;
  /** XP still required for the next rank; 0 at the highest rank. */
  xpToNext: number;
  /** Progress through the CURRENT band, 0–100; 100 at the highest rank. */
  progressPct: number;
}

/** Resolve XP into a rank plus progress toward the next one. */
export function resolveRank(xp: number): RankProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (safeXp >= RANKS[i]!.minXp) index = i;
  }
  const rank = RANKS[index]!;
  const nextRank = index < RANKS.length - 1 ? RANKS[index + 1]! : null;

  if (!nextRank) {
    return { rank, xp: safeXp, nextRank: null, xpToNext: 0, progressPct: 100 };
  }
  const band = nextRank.minXp - rank.minXp;
  const into = safeXp - rank.minXp;
  return {
    rank,
    xp: safeXp,
    nextRank,
    xpToNext: Math.max(0, nextRank.minXp - safeXp),
    progressPct: band <= 0 ? 100 : Math.min(100, Math.round((into / band) * 100)),
  };
}

/** True when the added fixture pushed the supporter into a higher rank. */
export function didRankAdvance(xpBefore: number, xpAfter: number): boolean {
  return resolveRank(xpAfter).rank.key !== resolveRank(xpBefore).rank.key;
}

/** Prediction accuracy over GRADED fixtures only. Null when nothing is graded. */
export function computeAccuracyPct(records: readonly XpFixtureRecord[]): number | null {
  const graded = records.filter((r) => r.isCorrect !== null);
  if (graded.length === 0) return null;
  const correct = graded.filter((r) => r.isCorrect === true).length;
  return Math.round((correct / graded.length) * 100);
}
