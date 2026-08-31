/**
 * FanHour commentary reactions.
 *
 * These are transient CONTEXTUAL MICROCOPY — not badges, achievements,
 * collectibles, trophies, inventory or unlockables. They carry no XP, no rank
 * effect and no sponsor-benefit implication. They exist so FanHour reacts to a
 * supporter the way a football commentator would.
 *
 * Rules enforced here (see docs/ARCHITECTURE.md):
 *  1. At most ONE phrase per feedback moment.
 *  2. Selection is deterministic and semantically justified — never random.
 *  3. Community-based phrases require a real, sufficient sample.
 *  4. Phrases never affect XP.
 *  5. Phrases never affect rewards.
 *  6. No product mechanic is invented to make a phrase fire.
 *  7. The phrase string is preserved exactly.
 *  8. Repetition is suppressed for phrases that could otherwise recur.
 *  9. Supporting copy always explains WHY the reaction appeared.
 */

export type ReactionKey =
  | 'BEL_MILLIMETER'
  | 'YA_RABAAH'
  | 'AYNI_AYNI'
  | 'YWAZZAA'
  | 'KNOCKOUT_POSSIBLE';

/** Approved phrases — preserved verbatim, never rewritten. */
export const REACTION_PHRASES: Record<ReactionKey, string> = {
  BEL_MILLIMETER: 'بالمليمتر يا حبيبي!',
  YA_RABAAH: 'يا رباه!',
  AYNI_AYNI: 'عيني عيني!',
  YWAZZAA: 'يوززززززع!',
  KNOCKOUT_POSSIBLE: 'الضربة القاضية ممكن!',
};

/**
 * Pilot 1 availability. YWAZZAA needs a genuine distribution/share interaction
 * and KNOCKOUT_POSSIBLE needs a decisive late-match context; neither exists in
 * a pre-match-only pilot, so both are deferred rather than forced.
 */
export const REACTION_ENABLED_IN_PILOT_1: Record<ReactionKey, boolean> = {
  BEL_MILLIMETER: true,
  YA_RABAAH: true,
  AYNI_AYNI: true,
  YWAZZAA: false,
  KNOCKOUT_POSSIBLE: false,
};

/** Configurable rarity bands for community-based reactions (percent shares). */
export const RARITY_BANDS = {
  /** At or below this share, a selection is rare enough for يا رباه!. */
  yaRabaahMaxSharePct: 10,
  /** Below this, the supporter is a strong minority. */
  strongMinorityPct: 15,
  /** Below this, the supporter is a minority. */
  minorityPct: 35,
} as const;

/** Threshold for admiring a recent run (عيني عيني!). */
export const PERFORMANCE_RULES = {
  recentWindow: 5,
  recentCorrectRequired: 4,
  /** Never claim a "record" before this many graded fixtures. */
  minGradedForPerformance: 5,
} as const;

/** Phrases that may repeat back-to-back; others are suppressed on repeat. */
const SUPPRESS_ON_REPEAT: ReadonlySet<ReactionKey> = new Set<ReactionKey>([
  'YA_RABAAH',
  'AYNI_AYNI',
]);

export type CommentaryMoment = 'post_submission' | 'post_resolution';

export interface CommentaryContext {
  moment: CommentaryMoment;
  /** Community standing of the supporter's own selection. */
  community?: {
    hasEnoughSample: boolean;
    /** Share of the community that chose the same option, 0–100. */
    chosenSharePct: number | null;
  } | null;
  /** Present only at post_resolution. */
  resolution?: {
    outcomeCorrect: boolean;
    exactCorrect: boolean;
  } | null;
  /** Multi-fixture performance, for admiration reactions. */
  performance?: {
    recentCorrect: number;
    recentWindow: number;
    gradedCount: number;
  } | null;
  /** Arabic name of the rank just reached, when the supporter advanced. */
  rankAdvancedToAr?: string | null;
  /** Most recent reaction keys shown to this supporter, newest first. */
  recentReactionKeys?: readonly ReactionKey[];
}

export interface CommentaryReaction {
  reactionKey: ReactionKey;
  phraseAr: string;
  /** i18n key for the supporting sentence — final copy never lives here. */
  supportingCopyKey: string;
  /** Machine-readable justification, for tests and Ops diagnostics. */
  reason: string;
  /** Values for interpolating the supporting copy. */
  data?: Record<string, string | number>;
}

interface Candidate extends CommentaryReaction {
  priority: number;
}

/** Rarity band of a selection, for neutral (non-catchphrase) social feedback. */
export type RarityBand = 'majority' | 'balanced' | 'minority' | 'strong_minority' | 'rare';

export function classifyRarity(sharePct: number): RarityBand {
  if (sharePct <= RARITY_BANDS.yaRabaahMaxSharePct) return 'rare';
  if (sharePct < RARITY_BANDS.strongMinorityPct) return 'strong_minority';
  if (sharePct < RARITY_BANDS.minorityPct) return 'minority';
  if (sharePct < 50) return 'balanced';
  return 'majority';
}

/**
 * Select at most one reaction. Deterministic; returns null when nothing is
 * genuinely justified — silence is the correct default.
 */
export function evaluateCommentaryReaction(
  ctx: CommentaryContext,
): CommentaryReaction | null {
  const candidates: Candidate[] = [];

  // Priority 1 — exact-score success. Only ever after resolution: before the
  // match the correctness is unknown, so the phrase would be unearned.
  if (ctx.moment === 'post_resolution' && ctx.resolution?.exactCorrect) {
    candidates.push({
      priority: 1,
      reactionKey: 'BEL_MILLIMETER',
      phraseAr: REACTION_PHRASES.BEL_MILLIMETER,
      supportingCopyKey: 'commentary.belMillimeter',
      reason: 'exact_score_correct',
    });
  }

  // Priority 2 — genuine rarity. Requires a real, sufficient community sample.
  const share = ctx.community?.chosenSharePct;
  if (
    ctx.community?.hasEnoughSample === true &&
    typeof share === 'number' &&
    share <= RARITY_BANDS.yaRabaahMaxSharePct
  ) {
    const correctAndRare = ctx.moment === 'post_resolution' && ctx.resolution?.outcomeCorrect === true;
    candidates.push({
      priority: 2,
      reactionKey: 'YA_RABAAH',
      phraseAr: REACTION_PHRASES.YA_RABAAH,
      supportingCopyKey: correctAndRare ? 'commentary.yaRabaahCorrect' : 'commentary.yaRabaahRare',
      reason: correctAndRare ? 'rare_selection_proved_right' : 'rare_selection',
      data: { sharePct: Math.round(share) },
    });
  }

  // Priority 3 — admiration: rank advancement, or a strong recent run.
  if (ctx.rankAdvancedToAr) {
    candidates.push({
      priority: 3,
      reactionKey: 'AYNI_AYNI',
      phraseAr: REACTION_PHRASES.AYNI_AYNI,
      supportingCopyKey: 'commentary.ayniAyniRank',
      reason: 'rank_advanced',
      data: { rank: ctx.rankAdvancedToAr },
    });
  } else if (
    ctx.performance &&
    ctx.performance.gradedCount >= PERFORMANCE_RULES.minGradedForPerformance &&
    ctx.performance.recentCorrect >= PERFORMANCE_RULES.recentCorrectRequired
  ) {
    candidates.push({
      priority: 3,
      reactionKey: 'AYNI_AYNI',
      phraseAr: REACTION_PHRASES.AYNI_AYNI,
      supportingCopyKey: 'commentary.ayniAyniRun',
      reason: 'strong_recent_accuracy',
      data: {
        correct: ctx.performance.recentCorrect,
        window: ctx.performance.recentWindow,
      },
    });
  }

  // Priorities 4 and 5 (YWAZZAA, KNOCKOUT_POSSIBLE) have no legitimate Pilot 1
  // trigger and are intentionally never produced.

  const previous = ctx.recentReactionKeys?.[0] ?? null;
  const ordered = candidates
    .filter((c) => REACTION_ENABLED_IN_PILOT_1[c.reactionKey])
    .sort((a, b) => a.priority - b.priority);

  for (const c of ordered) {
    // Rule 8: don't repeat the same phrase back-to-back where it could recur.
    if (previous === c.reactionKey && SUPPRESS_ON_REPEAT.has(c.reactionKey)) continue;
    const { priority: _priority, ...reaction } = c;
    void _priority;
    return reaction;
  }
  return null;
}
