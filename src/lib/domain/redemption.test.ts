import { describe, it, expect } from 'vitest';
import { decideRedemption } from './redemption';

const now = new Date('2026-09-01T18:00:00Z');
const future = new Date('2026-09-02T00:00:00Z');
const past = new Date('2026-09-01T00:00:00Z');

describe('redemption outcome mapping', () => {
  it('redeems a valid issued claim', () => {
    expect(
      decideRedemption({ claimStatus: 'issued', expiresAt: future, now, campaignActive: true }),
    ).toBe('redeemed');
  });
  it('reports already_redeemed', () => {
    expect(
      decideRedemption({ claimStatus: 'redeemed', expiresAt: future, now, campaignActive: true }),
    ).toBe('already_redeemed');
  });
  it('reports expired by status or by time', () => {
    expect(
      decideRedemption({ claimStatus: 'expired', expiresAt: future, now, campaignActive: true }),
    ).toBe('expired');
    expect(
      decideRedemption({ claimStatus: 'issued', expiresAt: past, now, campaignActive: true }),
    ).toBe('expired');
  });
  it('reports not_found for missing claim', () => {
    expect(
      decideRedemption({ claimStatus: null, expiresAt: null, now, campaignActive: true }),
    ).toBe('not_found');
  });
  it('reports campaign_paused when campaign inactive', () => {
    expect(
      decideRedemption({ claimStatus: 'issued', expiresAt: future, now, campaignActive: false }),
    ).toBe('campaign_paused');
  });
});

// Prompt §71 — redemption concurrency test.
// The DB guarantees atomicity via `UPDATE ... WHERE status='issued'`. We
// simulate that guarantee here: only the first attempt observes 'issued'.
describe('concurrent redemption (simulated atomic UPDATE)', () => {
  it('exactly one of two simultaneous attempts succeeds', () => {
    let status: 'issued' | 'redeemed' = 'issued';

    // Model the atomic compare-and-set the SQL performs.
    const attemptRedeem = (): 'redeemed' | 'already_redeemed' => {
      const outcome = decideRedemption({
        claimStatus: status,
        expiresAt: future,
        now,
        campaignActive: true,
      });
      if (outcome === 'redeemed') {
        status = 'redeemed'; // the WHERE status='issued' flips exactly one row
        return 'redeemed';
      }
      return 'already_redeemed';
    };

    const first = attemptRedeem();
    const second = attemptRedeem();
    const results = [first, second].sort();
    expect(results).toEqual(['already_redeemed', 'redeemed']);
  });
});
