import { describe, it, expect } from 'vitest';
import {
  evaluateCommentaryReaction, classifyRarity, REACTION_PHRASES,
  REACTION_ENABLED_IN_PILOT_1, type CommentaryContext,
} from './commentary';

const base: CommentaryContext = { moment: 'post_submission' };

describe('approved phrases are preserved verbatim', () => {
  it('keeps the exact Arabic strings', () => {
    expect(REACTION_PHRASES).toEqual({
      BEL_MILLIMETER: 'بالمليمتر يا حبيبي!',
      YA_RABAAH: 'يا رباه!',
      AYNI_AYNI: 'عيني عيني!',
      YWAZZAA: 'يوززززززع!',
      KNOCKOUT_POSSIBLE: 'الضربة القاضية ممكن!',
    });
  });
});

// Brief: exact prediction 2-1, actual 2-1 => BEL_MILLIMETER
describe('exact-score reaction', () => {
  it('fires بالمليمتر يا حبيبي! after resolution', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: true },
    });
    expect(r?.reactionKey).toBe('BEL_MILLIMETER');
    expect(r?.phraseAr).toBe('بالمليمتر يا حبيبي!');
    expect(r?.reason).toBe('exact_score_correct');
  });

  it('never fires at submission time — correctness is not yet known', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_submission',
      resolution: { outcomeCorrect: true, exactCorrect: true },
    });
    expect(r).toBeNull();
  });

  it('repeats back-to-back because an exact score is always earned', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: true },
      recentReactionKeys: ['BEL_MILLIMETER'],
    });
    expect(r?.reactionKey).toBe('BEL_MILLIMETER');
  });
});

// Brief: 7% share with sufficient sample => YA_RABAAH
describe('rarity reaction', () => {
  it('fires يا رباه! for a genuinely rare selection', () => {
    const r = evaluateCommentaryReaction({
      ...base,
      community: { hasEnoughSample: true, chosenSharePct: 7 },
    });
    expect(r?.reactionKey).toBe('YA_RABAAH');
    expect(r?.data?.sharePct).toBe(7);
  });

  // Brief: ordinary 61% majority => no catchphrase
  it('stays silent for an ordinary majority prediction', () => {
    const r = evaluateCommentaryReaction({
      ...base,
      community: { hasEnoughSample: true, chosenSharePct: 61 },
    });
    expect(r).toBeNull();
  });

  it('never fabricates rarity below the minimum sample', () => {
    const r = evaluateCommentaryReaction({
      ...base,
      community: { hasEnoughSample: false, chosenSharePct: 5 },
    });
    expect(r).toBeNull();
  });

  it('stays silent with no community data at all', () => {
    expect(evaluateCommentaryReaction(base)).toBeNull();
    expect(evaluateCommentaryReaction({ ...base, community: null })).toBeNull();
  });

  it('uses stronger copy when a rare call proved right', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: false },
      community: { hasEnoughSample: true, chosenSharePct: 8 },
    });
    expect(r?.reactionKey).toBe('YA_RABAAH');
    expect(r?.supportingCopyKey).toBe('commentary.yaRabaahCorrect');
  });
});

// Brief: reaching محلل مخضرم with no stronger event => AYNI_AYNI
describe('admiration reaction', () => {
  it('fires عيني عيني! on rank advancement', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: false },
      rankAdvancedToAr: 'محلل مخضرم',
    });
    expect(r?.reactionKey).toBe('AYNI_AYNI');
    expect(r?.data?.rank).toBe('محلل مخضرم');
  });

  it('fires عيني عيني! for 4 correct in the last 5', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: false },
      performance: { recentCorrect: 4, recentWindow: 5, gradedCount: 6 },
    });
    expect(r?.reactionKey).toBe('AYNI_AYNI');
    expect(r?.data).toEqual({ correct: 4, window: 5 });
  });

  it('does not claim a record before enough graded fixtures', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: false },
      performance: { recentCorrect: 4, recentWindow: 5, gradedCount: 4 },
    });
    expect(r).toBeNull();
  });
});

// Brief: exact score AND rank move at once => BEL_MILLIMETER wins
describe('priority ladder', () => {
  it('prefers the exact-score reaction over rank advancement', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: true },
      rankAdvancedToAr: 'محلل مخضرم',
      community: { hasEnoughSample: true, chosenSharePct: 6 },
    });
    expect(r?.reactionKey).toBe('BEL_MILLIMETER');
  });

  it('prefers rarity over admiration', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: false },
      community: { hasEnoughSample: true, chosenSharePct: 6 },
      rankAdvancedToAr: 'أسطورة',
    });
    expect(r?.reactionKey).toBe('YA_RABAAH');
  });

  it('returns at most one reaction per moment', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: true },
      community: { hasEnoughSample: true, chosenSharePct: 5 },
      rankAdvancedToAr: 'أسطورة',
      performance: { recentCorrect: 5, recentWindow: 5, gradedCount: 9 },
    });
    expect(r).not.toBeNull();
    expect(Object.keys(REACTION_PHRASES)).toContain(r!.reactionKey);
  });
});

describe('repetition suppression', () => {
  it('suppresses a repeated يا رباه! and falls through', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: false },
      community: { hasEnoughSample: true, chosenSharePct: 6 },
      rankAdvancedToAr: 'محلل خبير',
      recentReactionKeys: ['YA_RABAAH'],
    });
    expect(r?.reactionKey).toBe('AYNI_AYNI');
  });

  it('returns null when the only candidate is suppressed', () => {
    const r = evaluateCommentaryReaction({
      ...base,
      community: { hasEnoughSample: true, chosenSharePct: 6 },
      recentReactionKeys: ['YA_RABAAH'],
    });
    expect(r).toBeNull();
  });
});

describe('deferred phrases are never forced', () => {
  it('marks يوززززززع! and الضربة القاضية ممكن! unavailable in Pilot 1', () => {
    expect(REACTION_ENABLED_IN_PILOT_1.YWAZZAA).toBe(false);
    expect(REACTION_ENABLED_IN_PILOT_1.KNOCKOUT_POSSIBLE).toBe(false);
  });
  it('never emits a deferred phrase from any context', () => {
    const contexts: CommentaryContext[] = [
      { moment: 'post_submission', community: { hasEnoughSample: true, chosenSharePct: 2 } },
      { moment: 'post_resolution', resolution: { outcomeCorrect: true, exactCorrect: true } },
      { moment: 'post_resolution', rankAdvancedToAr: 'أسطورة' },
    ];
    for (const c of contexts) {
      const r = evaluateCommentaryReaction(c);
      expect(['YWAZZAA', 'KNOCKOUT_POSSIBLE']).not.toContain(r?.reactionKey);
    }
  });
});

describe('rarity bands', () => {
  it.each([
    [5, 'rare'], [10, 'rare'], [12, 'strong_minority'],
    [20, 'minority'], [40, 'balanced'], [61, 'majority'],
  ])('classifies %i%% as %s', (pct, band) => {
    expect(classifyRarity(pct)).toBe(band);
  });
});

describe('commentary is expression, not progression', () => {
  it('returns no XP or reward fields', () => {
    const r = evaluateCommentaryReaction({
      moment: 'post_resolution',
      resolution: { outcomeCorrect: true, exactCorrect: true },
    });
    expect(r).not.toBeNull();
    expect(Object.keys(r!)).toEqual(
      expect.not.arrayContaining(['xp', 'reward', 'benefit', 'eligibility']),
    );
  });
});
