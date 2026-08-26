import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { getCampaignBySlug } from '@/lib/data/campaigns';
import {
  getSupporterState,
  getSupporterQualifiedFixtureIds,
} from '@/lib/identity/supporter';
import { evaluateEligibility } from '@/lib/domain/eligibility';
import { generateRedemptionToken, hashRedemptionToken, generateFallbackCode } from '@/lib/security/tokens';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

const Body = z.object({
  campaignSlug: z.string().min(1),
  consentBenefit: z.literal(true), // required acceptance
  consentMarketing: z.boolean().optional(), // separate, opt-in (prompt §16)
  ageConfirmed: z.boolean().optional(),
  locality: z
    .enum(['al_rass', 'rest_of_qassim', 'other_ksa', 'outside_ksa', 'unknown'])
    .optional(),
});

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  const supporter = await getSupporterState();
  if (!supporter.supporterId || !supporter.isVerified) {
    // Identity is required only at claim (prompt §12, §13).
    return NextResponse.json({ error: 'verification_required' }, { status: 401 });
  }

  const campaign = await getCampaignBySlug(parsed.campaignSlug);
  if (!campaign || !campaign.isActive || !campaign.fixtureId) {
    return NextResponse.json({ error: 'campaign_unavailable' }, { status: 404 });
  }

  const supabase = getAdminClient();

  // Persist consents (required + optional separately) with policy versions.
  await supabase.from('consent').insert([
    {
      supporter_id: supporter.supporterId,
      type: 'benefit_terms',
      policy_version: serverConfig.termsVersion,
      granted: true,
      source: 'benefit_claim',
    },
    {
      supporter_id: supporter.supporterId,
      type: 'marketing',
      policy_version: serverConfig.privacyPolicyVersion,
      granted: Boolean(parsed.consentMarketing),
      source: 'benefit_claim',
    },
  ]);
  await recordEvent({
    name: EVENTS.consent_given,
    supporterId: supporter.supporterId,
    campaignId: campaign.id,
    props: { marketing: Boolean(parsed.consentMarketing) },
  });

  // Update supporter age/locality if provided.
  const patch: Record<string, unknown> = {};
  if (parsed.ageConfirmed !== undefined) patch.age_meets_requirement = parsed.ageConfirmed;
  if (parsed.locality) patch.locality = parsed.locality;
  if (Object.keys(patch).length > 0) {
    await supabase.from('supporter').update(patch).eq('id', supporter.supporterId);
  }

  const qualifiedFixtureIds = await getSupporterQualifiedFixtureIds(supporter.supporterId);

  const eligibility = evaluateEligibility(
    {
      campaignId: campaign.id,
      fixtureId: campaign.fixtureId,
      eligibilityMode: campaign.eligibilityMode,
      complianceMode: campaign.complianceMode,
      isActive: campaign.isActive,
      minAge: campaign.minAge,
      allowedLocalities: campaign.allowedLocalities.length ? campaign.allowedLocalities : undefined,
    },
    {
      qualifiedFixtureIds,
      ageConfirmedMeetsRequirement:
        parsed.ageConfirmed ?? supporter.ageMeetsRequirement,
      localitySegment: parsed.locality ?? supporter.locality,
    },
    { regulatedPrizeApproved: campaign.legalApprovalStatus === 'approved' },
  );

  if (!eligibility.eligible) {
    return NextResponse.json({ error: 'not_eligible', reason: eligibility.reason }, { status: 403 });
  }

  // Mint an opaque high-entropy token; store only its hash.
  const token = generateRedemptionToken();
  const fallbackCode = generateFallbackCode();
  const tokenHash = hashRedemptionToken(token);

  const { data: claimId, error } = await supabase.rpc('issue_claim_atomic', {
    p_campaign_id: campaign.id,
    p_fixture_id: campaign.fixtureId,
    p_supporter_id: supporter.supporterId,
    p_token_hash: tokenHash,
    p_fallback_code: fallbackCode,
    p_expires_at: campaign.expiresAt,
    p_is_test: campaign.isTest,
  });

  if (error) {
    if (error.message.includes('cap_reached')) {
      return NextResponse.json({ error: 'cap_reached' }, { status: 409 });
    }
    // Unique (campaign, supporter) => already claimed. Surface existing.
    if (error.code === '23505' || error.message.includes('duplicate')) {
      return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
    }
    return NextResponse.json({ error: 'issue_failed' }, { status: 500 });
  }

  await recordEvent({
    name: EVENTS.benefit_issued,
    supporterId: supporter.supporterId,
    campaignId: campaign.id,
    sponsorId: campaign.sponsorId,
    fixtureId: campaign.fixtureId,
    props: { claim_id: claimId },
  });

  // The raw token is returned once, to the supporter only, for the QR/URL.
  return NextResponse.json({ ok: true, token, fallbackCode });
}
