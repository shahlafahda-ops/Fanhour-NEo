import { describe, it, expect } from 'vitest';
import {
  computeCurrentStreak, computeBestStreak, summarizeStreak,
  participationInLastClosed, type FixtureStreakEntry,
} from './streak';

const f = (
  fixtureId: string,
  participated: boolean,
  opts: { eligible?: boolean; closed?: boolean } = {},
): FixtureStreakEntry => ({
  fixtureId,
  participated,
  eligible: opts.eligible ?? true,
  closed: opts.closed ?? true,
});

describe('current fixture streak', () => {
  it('counts consecutive participation from the most recent fixture', () => {
    expect(computeCurrentStreak([f('1', true), f('2', true), f('3', true)])).toBe(3);
  });
  it('breaks on a closed eligible fixture that was missed', () => {
    expect(computeCurrentStreak([f('1', true), f('2', false), f('3', true)])).toBe(1);
  });
  it('is zero when the latest closed fixture was missed', () => {
    expect(computeCurrentStreak([f('1', true), f('2', false)])).toBe(0);
  });
  it('is zero with no participation', () => {
    expect(computeCurrentStreak([f('1', false), f('2', false)])).toBe(0);
  });
});

describe('fixtures that must not punish the supporter', () => {
  it('a cancelled (ineligible) fixture never breaks the streak', () => {
    const t = [f('1', true), f('2', false, { eligible: false }), f('3', true)];
    expect(computeCurrentStreak(t)).toBe(2);
  });
  it('a fixture where prediction was unavailable never breaks the streak', () => {
    const t = [f('1', true), f('2', false, { eligible: false }), f('3', true), f('4', true)];
    expect(computeCurrentStreak(t)).toBe(3);
  });
  it('a still-open fixture not yet predicted is pending, not a miss', () => {
    const t = [f('1', true), f('2', true), f('3', false, { closed: false })];
    expect(computeCurrentStreak(t)).toBe(2);
  });
  it('predicting the still-open fixture extends the streak', () => {
    const t = [f('1', true), f('2', true), f('3', true, { closed: false })];
    expect(computeCurrentStreak(t)).toBe(3);
  });
});

describe('best fixture streak', () => {
  it('finds the longest historical run', () => {
    const t = [f('1', true), f('2', true), f('3', false), f('4', true), f('5', true), f('6', true)];
    expect(computeBestStreak(t)).toBe(3);
    expect(computeCurrentStreak(t)).toBe(3);
  });
  it('keeps the best when the current streak is broken', () => {
    const t = [f('1', true), f('2', true), f('3', true), f('4', false)];
    expect(computeBestStreak(t)).toBe(3);
    expect(computeCurrentStreak(t)).toBe(0);
  });
  it('bridges an ineligible fixture', () => {
    const t = [f('1', true), f('2', false, { eligible: false }), f('3', true)];
    expect(computeBestStreak(t)).toBe(2);
  });
});

describe('summary and recent window', () => {
  it('summarizes participation', () => {
    const t = [f('1', true), f('2', false), f('3', true), f('4', false, { eligible: false })];
    expect(summarizeStreak(t)).toEqual({
      current: 1, best: 1, participated: 2, eligibleClosed: 3,
    });
  });
  it('counts participation over the last N closed fixtures', () => {
    const t = [f('1', true), f('2', false), f('3', true), f('4', true)];
    expect(participationInLastClosed(t, 3)).toEqual({ participated: 2, window: 3 });
  });
  it('shrinks the window when history is short', () => {
    expect(participationInLastClosed([f('1', true)], 5)).toEqual({ participated: 1, window: 1 });
  });
});
