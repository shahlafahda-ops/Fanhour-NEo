import { describe, it, expect } from 'vitest';
import {
  computeQmp,
  isMraf,
  classifyNewVsReturning,
  participationOverRecentFixtures,
  qmpBucketsReached,
} from './retention';

// Prompt §69 — MRAF implementation test.
describe('MRAF / QMP semantics', () => {
  it('Case A: predicts Fixture 1 only => MRAF false, QMP 1', () => {
    const p = [{ fixtureId: 'f1' }];
    expect(isMraf(p)).toBe(false);
    expect(computeQmp(p)).toBe(1);
  });

  it('Case B: opens Fixture 2 but does not predict => still MRAF false', () => {
    // "opening" produces no qualified participation record at all.
    const p = [{ fixtureId: 'f1' }];
    expect(isMraf(p)).toBe(false);
  });

  it('Case C: predicts Fixture 2 => MRAF true', () => {
    const p = [{ fixtureId: 'f1' }, { fixtureId: 'f2' }];
    expect(isMraf(p)).toBe(true);
    expect(computeQmp(p)).toBe(2);
  });

  it('Case D: changes Fixture 2 prediction five times => QMP stays 2', () => {
    const p = [
      { fixtureId: 'f1' },
      { fixtureId: 'f2' },
      { fixtureId: 'f2' },
      { fixtureId: 'f2' },
      { fixtureId: 'f2' },
      { fixtureId: 'f2' },
    ];
    expect(computeQmp(p)).toBe(2);
    expect(isMraf(p)).toBe(true);
  });

  it('Case E: opens Fixture 1 again => no additional QMP', () => {
    const p = [{ fixtureId: 'f1' }, { fixtureId: 'f2' }, { fixtureId: 'f1' }];
    expect(computeQmp(p)).toBe(2);
  });
});

describe('QMP buckets', () => {
  it('reports reached buckets', () => {
    const p = ['f1', 'f2', 'f3', 'f4'].map((fixtureId) => ({ fixtureId }));
    expect(qmpBucketsReached(p)).toEqual([1, 2, 4]);
  });
});

describe('new vs returning', () => {
  it('is new with no prior distinct fixtures', () => {
    expect(classifyNewVsReturning([], 'f1')).toBe('new');
  });
  it('is new when only prior participation is the current fixture', () => {
    expect(classifyNewVsReturning([{ fixtureId: 'f1' }], 'f1')).toBe('new');
  });
  it('is returning with a prior distinct fixture', () => {
    expect(classifyNewVsReturning([{ fixtureId: 'f1' }], 'f2')).toBe('returning');
  });
});

describe('participation over recent fixtures', () => {
  it('counts distinct participation within the window', () => {
    const p = [{ fixtureId: 'f1' }, { fixtureId: 'f3' }, { fixtureId: 'f5' }];
    const recent = ['f6', 'f5', 'f4', 'f3', 'f2', 'f1'];
    expect(participationOverRecentFixtures(p, recent)).toEqual({ participated: 3, window: 6 });
  });
});
