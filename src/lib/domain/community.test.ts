import { describe, it, expect } from 'vitest';
import { computeCommunityDistribution } from './community';

describe('community distribution honesty', () => {
  it('withholds percentages below the minimum sample', () => {
    const d = computeCommunityDistribution({ hazem_win: 5, draw: 2, opponent_win: 1 }, 20);
    expect(d.hasEnoughSample).toBe(false);
    expect(d.percentages).toBeNull();
    expect(d.total).toBe(8);
  });

  it('shows integer percentages summing to 100 at/above threshold', () => {
    const d = computeCommunityDistribution({ hazem_win: 63, draw: 25, opponent_win: 12 }, 20);
    expect(d.hasEnoughSample).toBe(true);
    const p = d.percentages!;
    expect(p.hazem_win + p.draw + p.opponent_win).toBe(100);
    expect(p.hazem_win).toBe(63);
  });

  it('largest-remainder keeps the sum exactly 100 on awkward splits', () => {
    const d = computeCommunityDistribution({ hazem_win: 1, draw: 1, opponent_win: 1 }, 3);
    const p = d.percentages!;
    expect(p.hazem_win + p.draw + p.opponent_win).toBe(100);
  });
});
