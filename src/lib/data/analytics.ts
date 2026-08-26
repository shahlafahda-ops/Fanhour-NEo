import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { computeQmp, isMraf } from '@/lib/domain/retention';

export interface DashboardMetrics {
  // Acquisition / activation
  fixtureViews: number;
  predictionsStarted: number;
  predictionsSubmitted: number;
  completionRatePct: number | null;
  // Retention
  mrafCount: number;
  qmp1: number;
  qmp2: number;
  qmp4: number;
  qmp8: number;
  // Commercial funnel
  benefitViews: number;
  claimsStarted: number;
  otpRequested: number;
  otpVerified: number;
  benefitsIssued: number;
  redemptionsValidated: number;
  claimToRedemptionPct: number | null;
  // Fulfilment
  redemptionFailed: number;
  supportRequests: number;
}

async function countEvent(name: string): Promise<number> {
  const supabase = getAdminClient();
  const { count } = await supabase
    .from('event')
    .select('*', { count: 'exact', head: true })
    .eq('name', name);
  return count ?? 0;
}

/**
 * Retention is computed from the PREDICTION table (the authoritative qualified
 * participation), not from page-view events — QMP/MRAF count distinct fixtures
 * per identity (prompt §38, §39, §43).
 */
async function computeRetention() {
  const supabase = getAdminClient();
  // Prefer verified supporter id; fall back to anonymous session id.
  const { data } = await supabase
    .from('prediction')
    .select('supporter_id, anonymous_session_id, fixture_id');

  const byIdentity = new Map<string, Set<string>>();
  for (const row of (data as {
    supporter_id: string | null;
    anonymous_session_id: string | null;
    fixture_id: string;
  }[]) ?? []) {
    const key = row.supporter_id ?? row.anonymous_session_id;
    if (!key) continue;
    if (!byIdentity.has(key)) byIdentity.set(key, new Set());
    byIdentity.get(key)!.add(row.fixture_id);
  }

  let mraf = 0;
  const buckets = { q1: 0, q2: 0, q4: 0, q8: 0 };
  for (const fixtures of byIdentity.values()) {
    const parts = Array.from(fixtures).map((fixtureId) => ({ fixtureId }));
    const qmp = computeQmp(parts);
    if (isMraf(parts)) mraf += 1;
    if (qmp >= 1) buckets.q1 += 1;
    if (qmp >= 2) buckets.q2 += 1;
    if (qmp >= 4) buckets.q4 += 1;
    if (qmp >= 8) buckets.q8 += 1;
  }
  return { mraf, buckets };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  if (!hasSupabase()) return null;

  const [
    fixtureViews,
    predictionsStarted,
    predictionsSubmitted,
    benefitViews,
    claimsStarted,
    otpRequested,
    otpVerified,
    benefitsIssued,
    redemptionsValidated,
    redemptionFailed,
    supportRequests,
    retention,
  ] = await Promise.all([
    countEvent('fixture_viewed'),
    countEvent('prediction_started'),
    countEvent('prediction_submitted'),
    countEvent('benefit_viewed'),
    countEvent('claim_started'),
    countEvent('otp_requested'),
    countEvent('otp_verified'),
    countEvent('benefit_issued'),
    countEvent('redemption_validated'),
    countEvent('redemption_failed'),
    countEvent('support_requested'),
    computeRetention(),
  ]);

  return {
    fixtureViews,
    predictionsStarted,
    predictionsSubmitted,
    completionRatePct:
      predictionsStarted > 0
        ? Math.round((predictionsSubmitted / predictionsStarted) * 100)
        : null,
    mrafCount: retention.mraf,
    qmp1: retention.buckets.q1,
    qmp2: retention.buckets.q2,
    qmp4: retention.buckets.q4,
    qmp8: retention.buckets.q8,
    benefitViews,
    claimsStarted,
    otpRequested,
    otpVerified,
    benefitsIssued,
    redemptionsValidated,
    claimToRedemptionPct:
      benefitsIssued > 0 ? Math.round((redemptionsValidated / benefitsIssued) * 100) : null,
    redemptionFailed,
    supportRequests,
  };
}
