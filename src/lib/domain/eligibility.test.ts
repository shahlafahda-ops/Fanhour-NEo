import { describe, it, expect } from 'vitest';
import {
  evaluateEligibility,
  campaignCanGoLive,
  type CampaignEligibilityConfig,
  type SupporterEligibilityContext,
} from './eligibility';

const baseCampaign: CampaignEligibilityConfig = {
  campaignId: 'c1',
  fixtureId: 'f3',
  eligibilityMode: 'fixture_participation',
  complianceMode: 'participation_benefit',
  isActive: true,
  minAge: 18,
};

const eligibleSupporter: SupporterEligibilityContext = {
  qualifiedFixtureIds: ['f3'],
  ageConfirmedMeetsRequirement: true,
  localitySegment: 'al_rass',
};

// Prompt §70 — benefit eligibility test.
describe('campaign benefit eligibility (fixture-linked)', () => {
  it('is NOT eligible when supporter only participated in a different fixture', () => {
    const supporter: SupporterEligibilityContext = {
      ...eligibleSupporter,
      qualifiedFixtureIds: ['f2'],
    };
    const r = evaluateEligibility(baseCampaign, supporter, { regulatedPrizeApproved: false });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('no_qualifying_participation');
  });

  it('is eligible when supporter participated in the campaign fixture', () => {
    const r = evaluateEligibility(baseCampaign, eligibleSupporter, {
      regulatedPrizeApproved: false,
    });
    expect(r.eligible).toBe(true);
    expect(r.reason).toBe('eligible');
  });

  it('does NOT depend on prediction correctness (participation is enough)', () => {
    // No correctness data is even part of the eligibility context.
    const r = evaluateEligibility(baseCampaign, eligibleSupporter, {
      regulatedPrizeApproved: false,
    });
    expect(r.eligible).toBe(true);
  });

  it('rejects when age requirement not confirmed', () => {
    const supporter = { ...eligibleSupporter, ageConfirmedMeetsRequirement: null };
    const r = evaluateEligibility(baseCampaign, supporter, { regulatedPrizeApproved: false });
    expect(r.reason).toBe('age_requirement_not_met');
  });

  it('rejects inactive campaign', () => {
    const r = evaluateEligibility(
      { ...baseCampaign, isActive: false },
      eligibleSupporter,
      { regulatedPrizeApproved: false },
    );
    expect(r.reason).toBe('campaign_inactive');
  });

  it('blocks regulated_prize unless explicitly approved', () => {
    const campaign = { ...baseCampaign, complianceMode: 'regulated_prize' as const };
    expect(
      evaluateEligibility(campaign, eligibleSupporter, { regulatedPrizeApproved: false }).reason,
    ).toBe('regulated_prize_not_approved');
    expect(
      evaluateEligibility(campaign, eligibleSupporter, { regulatedPrizeApproved: true }).eligible,
    ).toBe(true);
  });

  it('any_participation mode allows a different fixture only when configured', () => {
    const campaign = { ...baseCampaign, eligibilityMode: 'any_participation' as const };
    const supporter = { ...eligibleSupporter, qualifiedFixtureIds: ['f2'] };
    expect(evaluateEligibility(campaign, supporter, { regulatedPrizeApproved: false }).eligible).toBe(
      true,
    );
  });

  it('enforces locality restriction when configured', () => {
    const campaign = { ...baseCampaign, allowedLocalities: ['al_rass'] as const };
    const supporter = { ...eligibleSupporter, localitySegment: 'other_ksa' as const };
    expect(evaluateEligibility(campaign, supporter, { regulatedPrizeApproved: false }).reason).toBe(
      'locality_not_eligible',
    );
  });
});

describe('campaignCanGoLive', () => {
  const complete = {
    complianceMode: 'participation_benefit' as const,
    legalApprovalStatus: 'not_required' as const,
    hasFixture: true,
    hasSponsor: true,
    hasBenefitDescription: true,
    hasTerms: true,
    hasExpiry: true,
    issueCap: 100,
  };

  it('allows a fully-configured participation_benefit campaign', () => {
    expect(campaignCanGoLive(complete).canGoLive).toBe(true);
  });

  it('blocks a regulated_prize without approval', () => {
    const r = campaignCanGoLive({ ...complete, complianceMode: 'regulated_prize' });
    expect(r.canGoLive).toBe(false);
    expect(r.missing).toContain('legal_approval');
  });

  it('lists all missing configuration', () => {
    const r = campaignCanGoLive({
      ...complete,
      hasFixture: false,
      hasTerms: false,
    });
    expect(r.missing).toEqual(expect.arrayContaining(['fixture', 'terms']));
  });
});
