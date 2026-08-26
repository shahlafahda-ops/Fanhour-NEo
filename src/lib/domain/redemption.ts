import type { ClaimStatus } from './types';

/**
 * Redemption state machine (pure logic mirror of the atomic SQL function
 * `redeem_claim`). The DATABASE is the authority for concurrency safety:
 * redemption is an `UPDATE ... WHERE status = 'issued'` that flips exactly one
 * row, so two simultaneous scans can never both succeed (prompt §30, §71).
 * This module documents the decision and powers unit tests of the outcome
 * mapping.
 */

export type RedemptionOutcome =
  | 'redeemed' // success — this request performed the redemption
  | 'already_redeemed'
  | 'expired'
  | 'void'
  | 'not_found'
  | 'campaign_paused'
  | 'not_eligible';

export interface RedemptionContext {
  claimStatus: ClaimStatus | null; // null => not_found
  expiresAt: Date | null;
  now: Date;
  campaignActive: boolean;
}

/**
 * Decide the outcome of a redemption attempt. In production the same predicate
 * is expressed atomically in SQL; here it is the single source of the mapping
 * between state and merchant-visible outcome.
 */
export function decideRedemption(ctx: RedemptionContext): RedemptionOutcome {
  if (ctx.claimStatus === null) return 'not_found';
  if (!ctx.campaignActive) return 'campaign_paused';

  switch (ctx.claimStatus) {
    case 'redeemed':
      return 'already_redeemed';
    case 'void':
      return 'void';
    case 'expired':
      return 'expired';
    case 'issued':
      if (ctx.expiresAt && ctx.now.getTime() > ctx.expiresAt.getTime()) {
        return 'expired';
      }
      return 'redeemed';
    default:
      return 'not_found';
  }
}

/** Arabic merchant-facing status label for each outcome. */
export const REDEMPTION_STATUS_AR: Record<RedemptionOutcome, string> = {
  redeemed: 'صالح — تم التأكيد',
  already_redeemed: 'مُستخدم سابقًا',
  expired: 'منتهي الصلاحية',
  void: 'غير مؤهل',
  not_found: 'غير معروف',
  campaign_paused: 'الحملة متوقفة',
  not_eligible: 'غير مؤهل',
};
