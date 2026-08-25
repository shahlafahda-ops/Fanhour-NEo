import { describe, it, expect } from 'vitest';
import {
  effectiveFixtureStatus,
  isPredictionEditable,
  resultFromScores,
  resultFromVenueScores,
  isPredictionCorrect,
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
