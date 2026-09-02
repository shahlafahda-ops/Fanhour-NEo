import { describe, it, expect } from 'vitest';
import {
  XP_VALUES, MAX_XP_PER_FIXTURE, RANKS, computeXp, xpForFixture, resolveRank,
  didRankAdvance, isExactScoreCorrect, computeAccuracyPct, parseProgressionConfig,
  DEFAULT_PROGRESSION_CONFIG, type XpFixtureRecord,
} from './progression';

const rec = (fixtureId: string, isCorrect: boolean | null, isExactCorrect = false): XpFixtureRecord =>
  ({ fixtureId, isCorrect, isExactCorrect });

describe('XP values', () => {
  it('awards participation only for an unresolved fixture', () => {
    expect(xpForFixture(rec('f1', null))).toBe(10);
  });
  it('awards participation + outcome for a correct prediction', () => {
    expect(xpForFixture(rec('f1', true))).toBe(30);
  });
  it('awards participation + outcome + exact for an exact score', () => {
    expect(xpForFixture(rec('f1', true, true))).toBe(50);
    expect(MAX_XP_PER_FIXTURE).toBe(50);
  });
  it('awards participation only for an incorrect prediction', () => {
    expect(xpForFixture(rec('f1', false))).toBe(10);
  });
  it('never awards exact XP without a correct outcome', () => {
    expect(xpForFixture(rec('f1', false, true))).toBe(10);
  });
  it('counts each fixture once even if rows repeat', () => {
    expect(computeXp([rec('f1', true), rec('f1', true), rec('f2', null)])).toBe(30 + 10);
  });
  it('exposes a single configurable XP table', () => {
    expect(XP_VALUES).toEqual({ participation: 10, correctOutcome: 20, exactScore: 20 });
  });
});

describe('exact-score derivation', () => {
  it('is true only when both predicted and both final scores match', () => {
    expect(isExactScoreCorrect({ hazem: 2, opponent: 1 }, { hazem: 2, opponent: 1 })).toBe(true);
    expect(isExactScoreCorrect({ hazem: 2, opponent: 1 }, { hazem: 3, opponent: 1 })).toBe(false);
  });
  it('is false when the supporter skipped the optional depth question', () => {
    expect(isExactScoreCorrect({ hazem: null, opponent: null }, { hazem: 2, opponent: 1 })).toBe(false);
  });
  it('is false when the fixture is unresolved', () => {
    expect(isExactScoreCorrect({ hazem: 2, opponent: 1 }, { hazem: null, opponent: null })).toBe(false);
  });
});

describe('rank boundaries', () => {
  it('uses the exact approved Arabic names in order', () => {
    expect(RANKS.map((r) => r.nameAr)).toEqual([
      'متابع', 'مشجع', 'محلل خبير', 'محلل مخضرم', 'أسطورة',
    ]);
  });
  it.each([
    [0, 'متابع'], [59, 'متابع'], [60, 'مشجع'], [149, 'مشجع'],
    [150, 'محلل خبير'], [259, 'محلل خبير'], [260, 'محلل مخضرم'],
    [379, 'محلل مخضرم'], [380, 'أسطورة'], [10_000, 'أسطورة'],
  ])('maps %i XP to %s', (xp, name) => {
    expect(resolveRank(xp).rank.nameAr).toBe(name);
  });
  it('reports progress toward the next rank', () => {
    const p = resolveRank(320);
    expect(p.rank.nameAr).toBe('محلل مخضرم');
    expect(p.nextRank?.nameAr).toBe('أسطورة');
    expect(p.xpToNext).toBe(60);
    expect(p.progressPct).toBe(50); // 60 of the 120-wide band
  });
  it('terminates cleanly at the highest rank', () => {
    const p = resolveRank(500);
    expect(p.nextRank).toBeNull();
    expect(p.xpToNext).toBe(0);
    expect(p.progressPct).toBe(100);
  });
  it('clamps negative XP', () => {
    expect(resolveRank(-50).rank.nameAr).toBe('متابع');
  });
});

describe('rank advancement', () => {
  it('detects crossing a boundary', () => {
    expect(didRankAdvance(140, 160)).toBe(true);
    expect(didRankAdvance(160, 180)).toBe(false);
  });
});

// Pilot calibration: participation alone must NOT reach محلل خبير.
describe('Pilot 1 progression curve (11–12 usable fixtures)', () => {
  const many = (n: number, correct: number, exact: number) => {
    const out: XpFixtureRecord[] = [];
    for (let i = 0; i < n; i += 1) {
      out.push(rec(`f${i}`, i < correct, i < exact));
    }
    return out;
  };
  it('caps an attendance-only supporter at مشجع', () => {
    const xp = computeXp(many(12, 0, 0));
    expect(xp).toBe(120);
    expect(resolveRank(xp).rank.nameAr).toBe('مشجع');
  });
  it('places a committed supporter at محلل مخضرم', () => {
    const xp = computeXp(many(12, 6, 1)); // 120 + 120 + 20
    expect(xp).toBe(260);
    expect(resolveRank(xp).rank.nameAr).toBe('محلل مخضرم');
  });
  it('keeps أسطورة achievable for an outlier within 11 fixtures', () => {
    const xp = computeXp(many(11, 10, 4)); // 110 + 200 + 80
    expect(xp).toBe(390);
    expect(resolveRank(xp).rank.nameAr).toBe('أسطورة');
  });
  it('does not make أسطورة mathematically impossible', () => {
    expect(RANKS[RANKS.length - 1]!.minXp).toBeLessThan(11 * MAX_XP_PER_FIXTURE);
  });
});

describe('accuracy', () => {
  it('ignores ungraded fixtures', () => {
    expect(computeAccuracyPct([rec('a', true), rec('b', false), rec('c', null)])).toBe(50);
  });
  it('is null with nothing graded', () => {
    expect(computeAccuracyPct([rec('a', null)])).toBeNull();
  });
});

describe('parseProgressionConfig (A6 — tunable without a deploy)', () => {
  it('falls back to defaults for null/undefined/non-object input', () => {
    expect(parseProgressionConfig(null)).toEqual(DEFAULT_PROGRESSION_CONFIG);
    expect(parseProgressionConfig(undefined)).toEqual(DEFAULT_PROGRESSION_CONFIG);
    expect(parseProgressionConfig('nonsense')).toEqual(DEFAULT_PROGRESSION_CONFIG);
    expect(parseProgressionConfig(42)).toEqual(DEFAULT_PROGRESSION_CONFIG);
  });

  it('accepts a valid override of XP values only', () => {
    const cfg = parseProgressionConfig({
      xpValues: { participation: 5, correctOutcome: 10, exactScore: 15 },
    });
    expect(cfg.xpValues).toEqual({ participation: 5, correctOutcome: 10, exactScore: 15 });
    expect(cfg.ranks).toEqual(RANKS); // unaffected
  });

  it('accepts a valid override of rank thresholds only, keeping exact names/keys/order', () => {
    const rebalanced = RANKS.map((r, i) => ({ ...r, minXp: i * 100 }));
    const cfg = parseProgressionConfig({ ranks: rebalanced });
    expect(cfg.ranks).toEqual(rebalanced);
    expect(cfg.xpValues).toEqual(XP_VALUES); // unaffected
  });

  it('rejects a rank ladder that renames or reorders a rank (Bronze/Silver-style)', () => {
    const tampered = RANKS.map((r) => ({ ...r }));
    tampered[1] = { ...tampered[1]!, nameAr: 'Silver' };
    expect(parseProgressionConfig({ ranks: tampered }).ranks).toEqual(RANKS);
  });

  it('rejects a rank ladder with the wrong number of ranks', () => {
    const tooFew = RANKS.slice(0, 3);
    expect(parseProgressionConfig({ ranks: tooFew }).ranks).toEqual(RANKS);
  });

  it('rejects a rank ladder not sorted strictly ascending from 0', () => {
    const notSorted = RANKS.map((r, i) => ({ ...r, minXp: i === 2 ? 10 : i * 100 }));
    expect(parseProgressionConfig({ ranks: notSorted }).ranks).toEqual(RANKS);
  });

  it('rejects malformed xpValues (missing/non-numeric fields)', () => {
    expect(
      parseProgressionConfig({ xpValues: { participation: 'ten' } }).xpValues,
    ).toEqual(XP_VALUES);
    expect(parseProgressionConfig({ xpValues: {} }).xpValues).toEqual(XP_VALUES);
  });

  it('xpForFixture/computeXp honour an overridden config', () => {
    const cfg = parseProgressionConfig({
      xpValues: { participation: 100, correctOutcome: 0, exactScore: 0 },
    });
    expect(xpForFixture(rec('f1', null), cfg)).toBe(100);
    expect(computeXp([rec('f1', null)], cfg)).toBe(100);
  });

  it('resolveRank honours an overridden rank ladder', () => {
    const rebalanced = RANKS.map((r, i) => ({ ...r, minXp: i * 1000 }));
    const cfg = parseProgressionConfig({ ranks: rebalanced });
    // 500 XP clears the default ladder's أسطورة (380) but not the rebalanced one's.
    expect(resolveRank(500).rank.key).toBe('ustoora');
    expect(resolveRank(500, cfg).rank.key).not.toBe('ustoora');
  });
});
