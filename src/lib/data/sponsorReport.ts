import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { computeVri, type VriResult } from '@/lib/domain/reach';

export interface FixtureBreakdownRow {
  fixtureId: string;
  opponentAr: string;
  kickoffAt: string;
  campaignTitleAr: string;
  reached: number;
  participated: number;
  eligiblePopulation: number;
  claimed: number;
  redeemed: number;
}

export interface SponsorReportData {
  sponsorNameAr: string;
  sponsorLogoUrl: string | null;
  vri: VriResult;
  totals: {
    reached: number;
    participated: number;
    eligiblePopulation: number;
    claimed: number;
    redeemed: number;
  };
  firstVisitShare: { yes: number; no: number; unsure: number; unanswered: number };
  perFixture: FixtureBreakdownRow[];
}

async function countEventForFixture(name: string, fixtureId: string): Promise<number> {
  const supabase = getAdminClient();
  const { count } = await supabase
    .from('event')
    .select('id', { head: true, count: 'exact' })
    .eq('name', name)
    .eq('fixture_id', fixtureId);
  return count ?? 0;
}

async function countEventForCampaign(name: string, campaignId: string): Promise<number> {
  const supabase = getAdminClient();
  const { count } = await supabase
    .from('event')
    .select('id', { head: true, count: 'exact' })
    .eq('name', name)
    .eq('campaign_id', campaignId);
  return count ?? 0;
}

/**
 * Every campaign for the sponsor behind `campaignSlug`, broken down per
 * fixture — a sponsor-level view even though the route is entered via one
 * campaign's slug. Ops-only; a real sponsor portal comes in Part B.
 */
export async function getSponsorReport(campaignSlug: string): Promise<SponsorReportData | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();

  const { data: entryCampaign } = await supabase
    .from('campaign')
    .select('sponsor_id, sponsor:sponsor_id ( name_ar, logo_url )')
    .eq('slug', campaignSlug)
    .maybeSingle();
  if (!entryCampaign) return null;

  const sponsorId = entryCampaign.sponsor_id as string;
  const sponsor = (entryCampaign.sponsor as unknown as Record<string, unknown> | null) ?? {};

  const { data: campaigns } = await supabase
    .from('campaign')
    .select('id, fixture_id, title_ar')
    .eq('sponsor_id', sponsorId)
    .not('fixture_id', 'is', null);

  const fixtureIds = (campaigns ?? []).map((c) => c.fixture_id as string);
  const { data: fixtures } = fixtureIds.length
    ? await supabase.from('fixture').select('id, opponent_ar, kickoff_at').in('id', fixtureIds)
    : { data: [] };
  const fixtureById = new Map(
    ((fixtures as { id: string; opponent_ar: string; kickoff_at: string }[]) ?? []).map((f) => [
      f.id,
      f,
    ]),
  );

  const perFixture: FixtureBreakdownRow[] = [];
  for (const c of campaigns ?? []) {
    const fixtureId = c.fixture_id as string;
    const fixture = fixtureById.get(fixtureId);
    if (!fixture) continue;

    const { count: eligiblePopulation } = await supabase
      .from('prediction')
      .select('id', { head: true, count: 'exact' })
      .eq('fixture_id', fixtureId);

    const [reached, participated, claimed, redeemed] = await Promise.all([
      countEventForFixture('fixture_viewed', fixtureId),
      countEventForFixture('prediction_submitted', fixtureId),
      countEventForCampaign('benefit_issued', c.id as string),
      countEventForCampaign('redemption_validated', c.id as string),
    ]);

    perFixture.push({
      fixtureId,
      opponentAr: fixture.opponent_ar,
      kickoffAt: fixture.kickoff_at,
      campaignTitleAr: c.title_ar as string,
      reached,
      participated,
      eligiblePopulation: eligiblePopulation ?? 0,
      claimed,
      redeemed,
    });
  }

  const totals = perFixture.reduce(
    (acc, r) => ({
      reached: acc.reached + r.reached,
      participated: acc.participated + r.participated,
      eligiblePopulation: acc.eligiblePopulation + r.eligiblePopulation,
      claimed: acc.claimed + r.claimed,
      redeemed: acc.redeemed + r.redeemed,
    }),
    { reached: 0, participated: 0, eligiblePopulation: 0, claimed: 0, redeemed: 0 },
  );

  // First-visit share across every redemption belonging to this sponsor's campaigns.
  const campaignIds = (campaigns ?? []).map((c) => c.id as string);
  const firstVisitShare = { yes: 0, no: 0, unsure: 0, unanswered: 0 };
  if (campaignIds.length > 0) {
    const { data: logs } = await supabase
      .from('redemption_log')
      .select('first_visit')
      .in('campaign_id', campaignIds)
      .eq('outcome', 'redeemed');
    for (const row of (logs as { first_visit: string | null }[]) ?? []) {
      if (row.first_visit === 'yes') firstVisitShare.yes += 1;
      else if (row.first_visit === 'no') firstVisitShare.no += 1;
      else if (row.first_visit === 'unsure') firstVisitShare.unsure += 1;
      else firstVisitShare.unanswered += 1;
    }
  }

  // VRI — platform-level verified reach, labelled explicitly in the report.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  const [{ count: registeredFans }, { data: activePreds }, { count: activeReminders }] =
    await Promise.all([
      supabase.from('supporter').select('id', { head: true, count: 'exact' }).eq('is_verified', true),
      supabase.from('prediction').select('supporter_id').gte('created_at', ninetyDaysAgo),
      supabase
        .from('reminder_subscription')
        .select('id', { head: true, count: 'exact' })
        .eq('state', 'active'),
    ]);
  const activeSupporters = new Set(
    ((activePreds as { supporter_id: string | null }[]) ?? [])
      .map((r) => r.supporter_id)
      .filter((id): id is string => Boolean(id)),
  );
  const registered = registeredFans ?? 0;
  const vri = computeVri({
    registeredFans: registered,
    activeRate90d: registered > 0 ? activeSupporters.size / registered : 0,
    notificationReachability: registered > 0 ? (activeReminders ?? 0) / registered : 0,
  });

  return {
    sponsorNameAr: (sponsor.name_ar as string) ?? '',
    sponsorLogoUrl: (sponsor.logo_url as string) ?? null,
    vri,
    totals,
    firstVisitShare,
    perFixture: perFixture.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
  };
}
