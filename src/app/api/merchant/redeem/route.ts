import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getMerchantIdentity } from '@/lib/auth/guards';
import { hashRedemptionToken } from '@/lib/security/tokens';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';
import { REDEMPTION_STATUS_AR, type RedemptionOutcome } from '@/lib/domain/redemption';

const Body = z
  .object({
    token: z.string().min(10).optional(),
    fallbackCode: z.string().min(4).max(20).optional(),
    confirm: z.boolean().optional(),
  })
  .refine((b) => b.token || b.fallbackCode, { message: 'token_or_code_required' });

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  // Merchant portal requires authentication + scoping (prompt §29, §52).
  const merchant = await getMerchantIdentity();
  if (!merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Locate the claim by token hash (preferred) or fallback code.
  let claimQuery = supabase
    .from('claim')
    .select('id, campaign_id, status, expires_at')
    .limit(1);
  if (parsed.token) {
    claimQuery = claimQuery.eq('token_hash', hashRedemptionToken(parsed.token));
  } else {
    // Fallback-code path is guessable-adjacent, so rate-limit per merchant user.
    const rl = await checkRateLimit(`redeem_code:${merchant.merchantUserId}`, 30, 3600);
    if (!rl.allowed) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
    claimQuery = claimQuery.eq('fallback_code', parsed.fallbackCode!.toUpperCase());
  }

  const { data: claim } = await claimQuery.maybeSingle();

  if (!claim) {
    await recordEvent({
      name: EVENTS.redemption_failed,
      merchantId: merchant.merchantId,
      props: { outcome: 'not_found' },
    });
    return statusResponse('not_found');
  }

  // Scoping: this merchant must be assigned to the claim's campaign.
  const { data: access } = await supabase
    .from('campaign_merchant')
    .select('campaign_id')
    .eq('campaign_id', claim.campaign_id)
    .eq('merchant_id', merchant.merchantId)
    .maybeSingle();
  if (!access) {
    // Do not reveal claim details for another merchant's campaign.
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await recordEvent({
    name: EVENTS.redemption_lookup,
    merchantId: merchant.merchantId,
    merchantLocationId: merchant.merchantLocationId,
    campaignId: claim.campaign_id as string,
    props: { claim_id: claim.id },
  });

  // Lookup-only (no confirm) => report validity without changing state.
  if (!parsed.confirm) {
    const preview = previewOutcome(claim.status as string, claim.expires_at as string | null);
    return statusResponse(preview, claim.campaign_id as string);
  }

  // Atomic, single-use redemption (prompt §30).
  const { data: outcome, error } = await supabase.rpc('redeem_claim_atomic', {
    p_claim_id: claim.id,
    p_merchant_id: merchant.merchantId,
    p_location_id: merchant.merchantLocationId,
    p_operator_id: merchant.merchantUserId,
  });

  if (error) {
    return NextResponse.json({ error: 'redeem_failed' }, { status: 500 });
  }

  const result = (outcome as RedemptionOutcome) ?? 'not_found';
  // The SERVER is the single authoritative source of these events (prompt §42).
  await recordEvent({
    name: result === 'redeemed' ? EVENTS.redemption_validated : EVENTS.redemption_failed,
    merchantId: merchant.merchantId,
    merchantLocationId: merchant.merchantLocationId,
    campaignId: claim.campaign_id as string,
    props: { claim_id: claim.id, outcome: result },
  });

  return statusResponse(result, claim.campaign_id as string);
}

function previewOutcome(status: string, expiresAt: string | null): RedemptionOutcome {
  if (status === 'redeemed') return 'already_redeemed';
  if (status === 'void') return 'void';
  if (status === 'expired') return 'expired';
  if (expiresAt && Date.now() > new Date(expiresAt).getTime()) return 'expired';
  return 'redeemed'; // "valid" preview
}

function statusResponse(outcome: RedemptionOutcome, campaignId?: string) {
  // Merchant sees status + campaign only — never PII (prompt §29).
  return NextResponse.json({
    outcome,
    statusAr: REDEMPTION_STATUS_AR[outcome],
    campaignId: campaignId ?? null,
  });
}
