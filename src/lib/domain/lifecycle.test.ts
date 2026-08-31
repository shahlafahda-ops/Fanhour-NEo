import { describe, it, expect } from 'vitest';
import { classifyLifecycle } from './lifecycle';
import type { FixtureStreakEntry } from './streak';

const f = (
  id: string, participated: boolean,
  opts: { eligible?: boolean; closed?: boolean } = {},
): FixtureStreakEntry => ({
  fixtureId: id, participated,
  eligible: opts.eligible ?? true, closed: opts.closed ?? true,
});

describe('lifecycle classification', () => {
  it('NEW with no qualified prediction', () => {
    expect(classifyLifecycle([f('1', false), f('2', false)])).toBe('NEW');
    expect(classifyLifecycle([])).toBe('NEW');
  });

  it('ACTIVATED after a single prediction', () => {
    expect(classifyLifecycle([f('1', true)])).toBe('ACTIVATED');
  });

  it('ENGAGED at 2 of the last 3 fixtures', () => {
    expect(classifyLifecycle([f('1', true), f('2', false), f('3', true)])).toBe('ENGAGED');
  });

  it('POWER_FAN at 4 consecutive fixtures', () => {
    expect(classifyLifecycle([f('1', true), f('2', true), f('3', true), f('4', true)]))
      .toBe('POWER_FAN');
  });

  it('AT_RISK after a previously engaged supporter misses two in a row', () => {
    const t = [f('1', true), f('2', true), f('3', true), f('4', false), f('5', false)];
    expect(classifyLifecycle(t)).toBe('AT_RISK');
  });

  it('does not mark a one-time supporter AT_RISK (never engaged)', () => {
    const t = [f('1', true), f('2', false), f('3', false)];
    expect(classifyLifecycle(t)).toBe('ACTIVATED');
  });

  it('a single miss does not trigger AT_RISK', () => {
    const t = [f('1', true), f('2', true), f('3', true), f('4', false)];
    expect(classifyLifecycle(t)).toBe('ENGAGED');
  });
});

describe('lifecycle transitions', () => {
  it('walks NEW -> ACTIVATED -> ENGAGED -> POWER_FAN -> AT_RISK', () => {
    const timeline: FixtureStreakEntry[] = [];
    expect(classifyLifecycle(timeline)).toBe('NEW');

    timeline.push(f('1', true));
    expect(classifyLifecycle(timeline)).toBe('ACTIVATED');

    timeline.push(f('2', true));
    expect(classifyLifecycle(timeline)).toBe('ENGAGED');

    timeline.push(f('3', true), f('4', true));
    expect(classifyLifecycle(timeline)).toBe('POWER_FAN');

    timeline.push(f('5', false), f('6', false));
    expect(classifyLifecycle(timeline)).toBe('AT_RISK');
  });

  it('recovers from AT_RISK on the next participation', () => {
    const t = [f('1', true), f('2', true), f('3', true), f('4', false), f('5', false)];
    expect(classifyLifecycle(t)).toBe('AT_RISK');
    t.push(f('6', true));
    expect(classifyLifecycle(t)).toBe('ACTIVATED');
  });

  it('ignores cancelled fixtures when judging misses', () => {
    const t = [
      f('1', true), f('2', true), f('3', true), f('4', true),
      f('5', false, { eligible: false }), f('6', false, { eligible: false }),
    ];
    expect(classifyLifecycle(t)).toBe('POWER_FAN');
  });

  it('does not count a still-open fixture as a miss', () => {
    const t = [
      f('1', true), f('2', true), f('3', true), f('4', true),
      f('5', false, { closed: false }),
    ];
    expect(classifyLifecycle(t)).toBe('POWER_FAN');
  });
});
