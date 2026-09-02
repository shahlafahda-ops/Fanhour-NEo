import { describe, it, expect } from 'vitest';
import { computeVri } from './reach';

describe('computeVri', () => {
  it('multiplies the three inputs and rounds to a whole fan', () => {
    const r = computeVri({ registeredFans: 1000, activeRate90d: 0.4, notificationReachability: 0.5 });
    expect(r.vri).toBe(200);
  });

  it('is zero with zero registered fans', () => {
    expect(computeVri({ registeredFans: 0, activeRate90d: 1, notificationReachability: 1 }).vri).toBe(0);
  });

  it('is zero with zero active rate or zero reachability', () => {
    expect(
      computeVri({ registeredFans: 500, activeRate90d: 0, notificationReachability: 1 }).vri,
    ).toBe(0);
    expect(
      computeVri({ registeredFans: 500, activeRate90d: 1, notificationReachability: 0 }).vri,
    ).toBe(0);
  });

  it('clamps out-of-range rates into [0, 1] rather than exploding the number', () => {
    const r = computeVri({ registeredFans: 100, activeRate90d: 1.5, notificationReachability: -0.2 });
    expect(r.inputs.activeRate90d).toBe(1);
    expect(r.inputs.notificationReachability).toBe(0);
    expect(r.vri).toBe(0);
  });

  it('never exceeds registeredFans, however the rates are combined', () => {
    const r = computeVri({ registeredFans: 300, activeRate90d: 1, notificationReachability: 1 });
    expect(r.vri).toBe(300);
  });

  it('echoes back the clamped inputs for labelling', () => {
    const r = computeVri({ registeredFans: 50.6, activeRate90d: 0.3, notificationReachability: 0.9 });
    expect(r.inputs.registeredFans).toBe(51);
  });
});
