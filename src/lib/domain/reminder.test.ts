import { describe, it, expect } from 'vitest';
import {
  assignHoldoutArm, HOLDOUT_PCT, riyadhHour, isQuietHours, deferIfQuietHours,
  cadenceSlotTime, isCadenceSlotDue, MAX_SENDS_PER_FIXTURE, REMINDER_TEMPLATES,
  validateTemplateParams, summarizeMrafByArm, MIN_SAMPLE_PER_ARM, type ArmMrafSample,
} from './reminder';

describe('assignHoldoutArm (randomised holdout — the experimental design)', () => {
  it('assigns holdout for the bottom 20% of the random draw', () => {
    expect(assignHoldoutArm(0)).toBe('holdout');
    expect(assignHoldoutArm(0.1999)).toBe('holdout');
  });
  it('assigns treatment for the remaining 80%', () => {
    expect(assignHoldoutArm(0.2)).toBe('treatment');
    expect(assignHoldoutArm(0.9999)).toBe('treatment');
  });
  it('rejects out-of-range input', () => {
    expect(() => assignHoldoutArm(-0.1)).toThrow();
    expect(() => assignHoldoutArm(1)).toThrow();
  });
  it('the holdout share is exactly 20% — never configurable to zero', () => {
    expect(HOLDOUT_PCT).toBe(0.2);
  });
  it('over a large uniform sample, the split is approximately 80/20', () => {
    let holdout = 0;
    const n = 20_000;
    // Deterministic pseudo-uniform sequence — no flakiness from Math.random().
    for (let i = 0; i < n; i += 1) {
      const rand = (i * 0.9999) / n;
      if (assignHoldoutArm(rand) === 'holdout') holdout += 1;
    }
    expect(holdout / n).toBeCloseTo(0.2, 1);
  });
});

describe('quiet hours (22:00–08:00 Asia/Riyadh, UTC+3 no DST)', () => {
  it('riyadhHour converts a UTC instant correctly', () => {
    expect(riyadhHour(new Date('2026-09-05T00:00:00Z'))).toBe(3); // 00:00 UTC -> 03:00 Riyadh
    expect(riyadhHour(new Date('2026-09-05T21:00:00Z'))).toBe(0); // 21:00 UTC -> 00:00 Riyadh next day
  });
  it('is quiet at 23:00 Riyadh and 05:00 Riyadh', () => {
    expect(isQuietHours(new Date('2026-09-05T20:00:00Z'))).toBe(true); // 23:00 Riyadh
    expect(isQuietHours(new Date('2026-09-05T02:00:00Z'))).toBe(true); // 05:00 Riyadh
  });
  it('is NOT quiet at 08:00 Riyadh (boundary) or 21:59 Riyadh', () => {
    expect(isQuietHours(new Date('2026-09-05T05:00:00Z'))).toBe(false); // exactly 08:00 Riyadh
    expect(isQuietHours(new Date('2026-09-05T18:59:00Z'))).toBe(false); // 21:59 Riyadh
  });
  it('is quiet exactly at 22:00 Riyadh (boundary)', () => {
    expect(isQuietHours(new Date('2026-09-05T19:00:00Z'))).toBe(true);
  });

  it('defers a late-night send (23:00 Riyadh) to the NEXT day 08:00 Riyadh', () => {
    const when = new Date('2026-09-05T20:00:00Z'); // 23:00 Riyadh, Sep 5
    const deferred = deferIfQuietHours(when);
    expect(deferred.toISOString()).toBe('2026-09-06T05:00:00.000Z'); // 08:00 Riyadh, Sep 6
  });
  it('defers an early-morning send (05:00 Riyadh) to the SAME day 08:00 Riyadh', () => {
    const when = new Date('2026-09-05T02:00:00Z'); // 05:00 Riyadh, Sep 5
    const deferred = deferIfQuietHours(when);
    expect(deferred.toISOString()).toBe('2026-09-05T05:00:00.000Z'); // 08:00 Riyadh, Sep 5
  });
  it('never defers a send already outside quiet hours', () => {
    const when = new Date('2026-09-05T10:00:00Z'); // 13:00 Riyadh
    expect(deferIfQuietHours(when)).toEqual(when);
  });
  it('deferral is idempotent (deferring an already-deferred time is a no-op)', () => {
    const when = new Date('2026-09-05T20:00:00Z');
    const once = deferIfQuietHours(when);
    const twice = deferIfQuietHours(once);
    expect(twice).toEqual(once);
  });
});

describe('cadenceSlotTime', () => {
  const kickoffAt = new Date('2026-09-10T18:00:00Z');

  it('T-48h and T-2h are relative to kickoff', () => {
    expect(cadenceSlotTime({ kickoffAt, resolvedAt: null }, 't_minus_48h')!.toISOString()).toBe(
      '2026-09-08T18:00:00.000Z',
    );
    expect(cadenceSlotTime({ kickoffAt, resolvedAt: null }, 't_minus_2h')!.toISOString()).toBe(
      '2026-09-10T16:00:00.000Z',
    );
  });
  it('resolution is null until the fixture is actually resolved', () => {
    expect(cadenceSlotTime({ kickoffAt, resolvedAt: null }, 'resolution')).toBeNull();
  });
  it('resolution fires at the resolution timestamp, not before', () => {
    const resolvedAt = new Date('2026-09-10T20:00:00Z');
    expect(cadenceSlotTime({ kickoffAt, resolvedAt }, 'resolution')).toEqual(resolvedAt);
  });
});

describe('isCadenceSlotDue (cap + de-dup)', () => {
  const now = new Date('2026-09-10T16:30:00Z');
  const scheduledAt = new Date('2026-09-10T16:00:00Z');

  it('is due once the scheduled time has passed', () => {
    expect(
      isCadenceSlotDue({ scheduledAt, now, alreadyLogged: false, sendsSoFarForFixture: 0 }),
    ).toBe(true);
  });
  it('is NOT due before the scheduled time', () => {
    expect(
      isCadenceSlotDue({
        scheduledAt: new Date('2026-09-10T17:00:00Z'),
        now,
        alreadyLogged: false,
        sendsSoFarForFixture: 0,
      }),
    ).toBe(false);
  });
  it('never fires twice for the same slot (already logged)', () => {
    expect(
      isCadenceSlotDue({ scheduledAt, now, alreadyLogged: true, sendsSoFarForFixture: 0 }),
    ).toBe(false);
  });
  it('enforces the hard cap of 3 sends per identity per fixture', () => {
    expect(
      isCadenceSlotDue({
        scheduledAt,
        now,
        alreadyLogged: false,
        sendsSoFarForFixture: MAX_SENDS_PER_FIXTURE,
      }),
    ).toBe(false);
  });
  it('is NOT due when there is no scheduled time (e.g. unresolved fixture)', () => {
    expect(
      isCadenceSlotDue({ scheduledAt: null, now, alreadyLogged: false, sendsSoFarForFixture: 0 }),
    ).toBe(false);
  });
});

describe('template parameter validation (no free text, ever)', () => {
  it('accepts a fully-parameterised template', () => {
    const t = REMINDER_TEMPLATES.t_minus_48h;
    expect(validateTemplateParams(t, { opponentAr: 'الشباب', kickoffLabel: 'الجمعة 20:00' })).toBe(
      true,
    );
  });
  it('rejects a missing parameter', () => {
    const t = REMINDER_TEMPLATES.t_minus_48h;
    const result = validateTemplateParams(t, { opponentAr: 'الشباب' });
    expect(result).not.toBe(true);
    expect((result as { missing: string[] }).missing).toEqual(['kickoffLabel']);
  });
  it('rejects an empty-string parameter', () => {
    const t = REMINDER_TEMPLATES.t_minus_2h;
    expect(validateTemplateParams(t, { opponentAr: '' })).not.toBe(true);
  });
  it('every cadence slot has a stable key + version', () => {
    for (const slot of Object.keys(REMINDER_TEMPLATES) as (keyof typeof REMINDER_TEMPLATES)[]) {
      expect(REMINDER_TEMPLATES[slot].key.length).toBeGreaterThan(0);
      expect(REMINDER_TEMPLATES[slot].version.length).toBeGreaterThan(0);
    }
  });
});

describe('summarizeMrafByArm (the experiment readout)', () => {
  const sample = (arm: 'treatment' | 'holdout', isMraf: boolean): ArmMrafSample => ({ arm, isMraf });

  it('computes n, mrafCount, and mrafRatePct per arm', () => {
    const samples: ArmMrafSample[] = [
      sample('treatment', true),
      sample('treatment', true),
      sample('treatment', false),
      sample('holdout', true),
      sample('holdout', false),
    ];
    const summary = summarizeMrafByArm(samples);
    expect(summary.treatment).toEqual({
      n: 3, mrafCount: 2, mrafRatePct: 66.7, sampleTooSmall: true,
    });
    expect(summary.holdout).toEqual({
      n: 2, mrafCount: 1, mrafRatePct: 50, sampleTooSmall: true,
    });
  });

  it('flags sampleTooSmall below MIN_SAMPLE_PER_ARM, not at/above it', () => {
    const below = Array.from({ length: MIN_SAMPLE_PER_ARM - 1 }, () => sample('treatment', false));
    const atThreshold = Array.from({ length: MIN_SAMPLE_PER_ARM }, () => sample('treatment', false));
    expect(summarizeMrafByArm(below).treatment.sampleTooSmall).toBe(true);
    expect(summarizeMrafByArm(atThreshold).treatment.sampleTooSmall).toBe(false);
  });

  it('mrafRatePct is null with zero samples in an arm', () => {
    const summary = summarizeMrafByArm([sample('treatment', true)]);
    expect(summary.holdout).toEqual({ n: 0, mrafCount: 0, mrafRatePct: null, sampleTooSmall: true });
  });

  it('never mixes arms', () => {
    const summary = summarizeMrafByArm([sample('holdout', true), sample('holdout', true)]);
    expect(summary.treatment.n).toBe(0);
    expect(summary.holdout.n).toBe(2);
  });
});
