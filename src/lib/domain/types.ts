/**
 * FanHour core domain types.
 * These mirror the database schema (supabase/migrations) but are the
 * authoritative shapes used by server business logic and tests.
 */

export type FixtureStatus =
  | 'scheduled' // created, predictions not yet open
  | 'open' // predictions accepted
  | 'locked' // cutoff passed, awaiting/ongoing match
  | 'resolved' // final result entered, predictions graded
  | 'cancelled';

/** Which side Al Hazem plays. Used to translate raw scores into an outcome. */
export type HomeAway = 'home' | 'away';

/** The three prediction choices, from Al Hazem's perspective. */
export type PredictionOutcome = 'hazem_win' | 'draw' | 'opponent_win';

/** Final fixture result, from Al Hazem's perspective. */
export type FixtureResult = 'hazem_win' | 'draw' | 'opponent_win';

export type ClaimStatus =
  | 'issued' // credential minted, not yet redeemed
  | 'redeemed' // redeemed at a merchant (terminal)
  | 'expired' // passed expiry without redemption (terminal)
  | 'void'; // cancelled by ops (terminal)

/**
 * Operating mode of a campaign. Legal/regulatory review of any campaign
 * happens outside FanHour before it is entered here — the product does not
 * model or gate on legal approval.
 */
export type ComplianceMode =
  | 'engagement_only' // no prize, no commercial benefit
  | 'participation_benefit'; // sponsor-funded, independent of prediction accuracy

/** When the benefit is revealed to the supporter. */
export type BenefitRevealTiming = 'post_submission' | 'post_result';

/** How a campaign decides who qualifies. */
export type CampaignEligibilityMode =
  | 'fixture_participation' // must have a qualified prediction on the campaign's fixture
  | 'any_participation'; // any qualified prediction (rare; must be explicitly configured)

export type OperationsRole = 'super_admin' | 'ops' | 'analyst' | 'support';

export type LocalitySegment =
  | 'al_rass'
  | 'rest_of_qassim'
  | 'other_ksa'
  | 'outside_ksa'
  | 'unknown';

export interface FixtureTimes {
  /** Predictions open at/after this instant. */
  predictionOpenAt: Date;
  /** Predictions close (cannot create/modify) at/after this instant. */
  cutoffAt: Date;
  kickoffAt: Date;
}

/** A qualified prediction: one authoritative record per identity per fixture. */
export interface Prediction {
  identityId: string;
  fixtureId: string;
  outcome: PredictionOutcome;
  exactHazemScore: number | null;
  exactOpponentScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}
