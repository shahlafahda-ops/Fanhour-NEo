import { describe, it, expect } from 'vitest';
import {
  effectiveFixtureStatus,
  isPredictionEditable,
  resultFromScores,
  resultFromVenueScores,
  isPredictionCorrect,
  selectActiveFixture,
} from './fixture';
import type { FixtureTimes } from './types';

const times: FixtureTimes = {
  predictionOpenAt: new Date('2026-09-01T10:00:00Z'),
  cutoffAt: new Date('2026-09-01T16:55:00Z'),
  kickoffAt: new Date('2026-09-01T17:00:00Z'),
};

describe('server-side fixture state (client clock must not decide)', () => {
  it('is scheduled before open', () => {
    expect(effectiveFixtureStatus('scheduled', times, new Date('2026-09-01T09:00:00Z'))).toBe(
      'scheduled',
    );
  });
  it('is open between open and cutoff', () => {
    expect(effectiveFixtureStatus('open', times, new Date('2026-09-01T12:00:00Z'))).toBe('open');
    expect(isPredictionEditable('open', times, new Date('2026-09-01T12:00:00Z'))).toBe(true);
  });
  it('is locked at/after cutoff', () => {
    expect(effectiveFixtureStatus('open', times, new Date('2026-09-01T16:55:00Z'))).toBe('locked');
    expect(isPredictionEditable('open', times, new Date('2026-09-01T16:56:00Z'))).toBe(false);
  });
  it('terminal stored status wins over time windows', () => {
    expect(effectiveFixtureStatus('resolved', times, new Date('2026-09-01T09:00:00Z'))).toBe(
      'resolved',
    );
    expect(effectiveFixtureStatus('cancelled', times, new Date('2026-09-01T12:00:00Z'))).toBe(
      'cancelled',
    );
  });
});

describe('result computation', () => {
  it('maps scores to result from Al Hazem perspective', () => {
    expect(resultFromScores(2, 1)).toBe('hazem_win');
    expect(resultFromScores(0, 0)).toBe('draw');
    expect(resultFromScores(1, 3)).toBe('opponent_win');
  });
  it('normalises venue scores by side', () => {
    // Al Hazem away, final home 1 - away 2 => Al Hazem won 2-1.
    expect(resultFromVenueScores(1, 2, 'away')).toBe('hazem_win');
    expect(resultFromVenueScores(1, 2, 'home')).toBe('opponent_win');
  });
  it('rejects invalid scores', () => {
    expect(() => resultFromScores(-1, 0)).toThrow();
    expect(() => resultFromScores(1.5, 0)).toThrow();
  });
  it('grades predictions', () => {
    expect(isPredictionCorrect('hazem_win', 'hazem_win')).toBe(true);
    expect(isPredictionCorrect('draw', 'hazem_win')).toBe(false);
  });
});

describe('selectActiveFixture (soonest-kickoff bug regression)', () => {
  const t = (kickoffIso: string, cutoffOffsetMin = -5) => {
    const kickoffAt = new Date(kickoffIso);
    return {
      predictionOpenAt: new Date(kickoffAt.getTime() - 3 * 24 * 60 * 60 * 1000),
      cutoffAt: new Date(kickoffAt.getTime() + cutoffOffsetMin * 60 * 1000),
      kickoffAt,
    };
  };
  const now = new Date('2026-08-31T12:00:00Z');

  it('reproduces the reported bug: a stale unresolved fixture must NOT bury a real upcoming one', () => {
    // Stray test fixture: kickoff was days ago, ops never resolved it — stored
    // status is still "open", but its real-time window has long closed.
    const staleTest = { id: 'stale', status: 'open' as const, kickoff: '2026-08-26T16:39:00Z' };
    // Real upcoming fixture, later kickoff, but genuinely still open right now.
    const realUpcoming = { id: 'real', status: 'open' as const, kickoff: '2026-08-30T20:00:00Z' };

    const times = (row: typeof staleTest) => t(row.kickoff);
    const winner = selectActiveFixture([staleTest, realUpcoming], times, now);

    // OLD (buggy) behaviour would sort by kickoff ascending and return `stale`.
    expect(winner?.id).toBe('real');
  });

  it('prefers an open fixture over a locked one', () => {
    const locked = { id: 'locked', status: 'locked' as const, kickoff: '2026-08-31T10:00:00Z' };
    // predictionOpenAt = kickoff - 3 days, so `now` (Aug 31) must fall within
    // 3 days of this kickoff for the fixture to be effectively "open".
    const open = { id: 'open', status: 'open' as const, kickoff: '2026-09-01T18:00:00Z' };
    const winner = selectActiveFixture([locked, open], (r) => t(r.kickoff), now);
    expect(winner?.id).toBe('open');
  });

  it('with no open fixture, picks the MOST RECENT locked one (current match), not an old one', () => {
    const oldLocked = { id: 'old', status: 'locked' as const, kickoff: '2026-08-20T18:00:00Z' };
    const currentLocked = { id: 'current', status: 'locked' as const, kickoff: '2026-08-31T11:00:00Z' };
    const winner = selectActiveFixture([oldLocked, currentLocked], (r) => t(r.kickoff), now);
    expect(winner?.id).toBe('current');
  });

  it('falls back to the soonest scheduled fixture when nothing is open or locked', () => {
    const later = { id: 'later', status: 'scheduled' as const, kickoff: '2026-09-10T18:00:00Z' };
    const sooner = { id: 'sooner', status: 'scheduled' as const, kickoff: '2026-09-05T18:00:00Z' };
    const winner = selectActiveFixture([later, sooner], (r) => t(r.kickoff), now);
    expect(winner?.id).toBe('sooner');
  });

  it('returns null with no candidates (caller falls back to most recently resolved)', () => {
    expect(selectActiveFixture([], () => t('2026-08-31T18:00:00Z'), now)).toBeNull();
  });

  it('ignores a resolved fixture even if it is technically in the candidate set', () => {
    const resolved = { id: 'resolved', status: 'resolved' as const, kickoff: '2026-08-31T10:00:00Z' };
    const open = { id: 'open', status: 'open' as const, kickoff: '2026-09-05T18:00:00Z' };
    const winner = selectActiveFixture([resolved, open], (r) => t(r.kickoff), now);
    expect(winner?.id).toBe('open');
  });
});
