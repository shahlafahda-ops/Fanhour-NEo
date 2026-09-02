import type { CampaignEligibilityMode, ComplianceMode, LocalitySegment } from './types';

/**
 * Campaign benefit eligibility.
 *
 * CRITICAL CORRECTION (prompt §24, §70): a benefit tied to Fixture X requires
 * a qualified participation in Fixture X. We must NEVER grant on the basis of
 * "participated in any FanHour match therefore eligible" unless a campaign is
 * *explicitly* configured with the `any_participation` mode.
 *
 * Eligibility for the STANDARD sponsor benefit does not depend on prediction
 * correctness (prompt §23).
 */

export interface CampaignEligibilityConfig {
  campaignId: string;
  fixtureId: string;
  eligibilityMode: CampaignEligibilityMode;
  complianceMode: ComplianceMode;
  isActive: boolean;
  /** Age gate for claiming (e.g. 18). */
  minAge: number;
  /** Localities allowed to claim; empty/undefined => no locality restriction. */
  allowedLocalities?: readonly LocalitySegment[];
}

export interface SupporterEligibilityContext {
  /** Distinct fixtures the supporter has a qualified prediction in. */
  qualifiedFixtureIds: readonly string[];
  /** Supporter's confirmed age eligibility (>= campaign.minAge). Null = unknown. */
  ageConfirmedMeetsRequirement: boolean | null;
  localitySegment: LocalitySegment;
}

export type EligibilityReason =
  | 'eligible'
  | 'campaign_inactive'
  | 'no_qualifying_participation'
  | 'age_requirement_not_met'
  | 'locality_not_eligible';

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
}

/** Decide whether a supporter may claim a campaign's benefit. */
export function evaluateEligibility(
  campaign: CampaignEligibilityConfig,
  supporter: SupporterEligibilityContext,
): EligibilityResult {
  if (!campaign.isActive) {
    return { eligible: false, reason: 'campaign_inactive' };
  }

  // Participation requirement — the core correction.
  const hasQualifyingParticipation =
    campaign.eligibilityMode === 'any_participation'
      ? supporter.qualifiedFixtureIds.length > 0
      : supporter.qualifiedFixtureIds.includes(campaign.fixtureId);

  if (!hasQualifyingParticipation) {
    return { eligible: false, reason: 'no_qualifying_participation' };
  }

  // Age gate (only enforced for benefit-bearing modes).
  const benefitBearing = campaign.complianceMode === 'participation_benefit';
  if (benefitBearing && campaign.minAge > 0) {
    if (supporter.ageConfirmedMeetsRequirement !== true) {
      return { eligible: false, reason: 'age_requirement_not_met' };
    }
  }

  // Locality restriction (optional).
  if (campaign.allowedLocalities && campaign.allowedLocalities.length > 0) {
    if (!campaign.allowedLocalities.includes(supporter.localitySegment)) {
      return { eligible: false, reason: 'locality_not_eligible' };
    }
  }

  return { eligible: true, reason: 'eligible' };
}

export interface CampaignLaunchConfig {
  hasFixture: boolean;
  hasSponsor: boolean;
  hasBenefitDescription: boolean;
  hasTerms: boolean;
  hasExpiry: boolean;
  issueCap: number | null;
}

export interface LaunchCheck {
  canGoLive: boolean;
  missing: string[];
}

/** Guard preventing a campaign from going live without required configuration. */
export function campaignCanGoLive(cfg: CampaignLaunchConfig): LaunchCheck {
  const missing: string[] = [];
  if (!cfg.hasFixture) missing.push('fixture');
  if (!cfg.hasSponsor) missing.push('sponsor');
  if (!cfg.hasBenefitDescription) missing.push('benefit_description');
  if (!cfg.hasTerms) missing.push('terms');
  if (!cfg.hasExpiry) missing.push('expiry');

  return { canGoLive: missing.length === 0, missing };
}
