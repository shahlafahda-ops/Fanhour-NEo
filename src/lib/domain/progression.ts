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

/**
 * The tunable part of the progression economy — XP values and rank
 * thresholds — as a plain data value so it can be overridden from
 * `feature_flag` (key `progression_config`) without a deploy. The RANK
 * NAMES and their order are never overridable (see `RANKS` above); only the
 * XP values and `minXp` thresholds can be retuned.
 */
export interface XpValues {
  participation: number;
  correctOutcome: number;
  exactScore: number;
}

export interface ProgressionConfig {
  xpValues: XpValues;
  ranks: readonly Rank[];
}

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  xpValues: XP_VALUES,
  ranks: RANKS,
};

/**
 * Parse a `feature_flag.value` payload into a `ProgressionConfig`, falling
 * back to the built-in defaults for anything missing or malformed. This is
 * the only place untrusted JSON from the DB is trusted into shape — every
 * rank must keep its exact approved `key`/`nameAr` (only `minXp` and the XP
 * values are actually tunable), and ranks must stay sorted by ascending
 * `minXp` starting at 0.
 */
export function parseProgressionConfig(value: unknown): ProgressionConfig {
  if (!value || typeof value !== 'object') return DEFAULT_PROGRESSION_CONFIG;
  const v = value as Record<string, unknown>;

  const xpValues = parseXpValues(v.xpValues) ?? XP_VALUES;

  const ranksInput = Array.isArray(v.ranks) ? v.ranks : null;
  const ranks = ranksInput && isValidRankLadder(ranksInput) ? ranksInput : RANKS;

  return { xpValues, ranks };
}

function parseXpValues(raw: unknown): XpValues | null {
  if (!raw || typeof raw !== 'object') return null;
  const { participation, correctOutcome, exactScore } = raw as Record<string, unknown>;
  if (
    !isFiniteNumber(participation) ||
    !isFiniteNumber(correctOutcome) ||
    !isFiniteNumber(exactScore)
  ) {
    return null;
  }
  return { participation, correctOutcome, exactScore };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * A rank ladder override must carry exactly the approved keys/names in the
 * approved order — Pilot 1 must never show Bronze/Silver/Gold-style
 * terminology. Only the `minXp` thresholds may differ from the default.
 */
function isValidRankLadder(candidate: unknown[]): candidate is Rank[] {
  if (candidate.length !== RANKS.length) return false;
  let previousMinXp = -1;
  for (let i = 0; i < candidate.length; i += 1) {
    const r = candidate[i] as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') return false;
    if (r.key !== RANKS[i]!.key || r.nameAr !== RANKS[i]!.nameAr) return false;
    if (!isFiniteNumber(r.minXp) || r.minXp < 0 || r.minXp <= previousMinXp) return false;
    previousMinXp = r.minXp;
  }
  return candidate[0] !== undefined && (candidate[0] as Rank).minXp === 0;
}

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
export function xpForFixture(
  rec: XpFixtureRecord,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
): number {
  const xpValues = config.xpValues;
  let xp = xpValues.participation;
  if (rec.isCorrect === true) xp += xpValues.correctOutcome;
  // Exact score only counts alongside a correct outcome — an exact score that
  // contradicts the outcome is impossible, so this is a defensive guard.
  if (rec.isCorrect === true && rec.isExactCorrect) xp += xpValues.exactScore;
  return xp;
}

/** Total XP across DISTINCT fixtures (duplicate fixture rows are ignored). */
export function computeXp(
  records: readonly XpFixtureRecord[],
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
): number {
  const seen = new Set<string>();
  let total = 0;
  for (const r of records) {
    if (seen.has(r.fixtureId)) continue;
    seen.add(r.fixtureId);
    total += xpForFixture(r, config);
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
export function resolveRank(
  xp: number,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
): RankProgress {
  const ranks = config.ranks;
  const safeXp = Math.max(0, Math.floor(xp));
  let index = 0;
  for (let i = 0; i < ranks.length; i += 1) {
    if (safeXp >= ranks[i]!.minXp) index = i;
  }
  const rank = ranks[index]!;
  const nextRank = index < ranks.length - 1 ? ranks[index + 1]! : null;

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
export function didRankAdvance(
  xpBefore: number,
  xpAfter: number,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
): boolean {
  return resolveRank(xpAfter, config).rank.key !== resolveRank(xpBefore, config).rank.key;
}

/** Prediction accuracy over GRADED fixtures only. Null when nothing is graded. */
export function computeAccuracyPct(records: readonly XpFixtureRecord[]): number | null {
  const graded = records.filter((r) => r.isCorrect !== null);
  if (graded.length === 0) return null;
  const correct = graded.filter((r) => r.isCorrect === true).length;
  return Math.round((correct / graded.length) * 100);
}
