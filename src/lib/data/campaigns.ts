import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { isTestDataAllowed } from '@/lib/config/env.server';
import type {
  BenefitRevealTiming,
  CampaignEligibilityMode,
  ComplianceMode,
  LegalApprovalStatus,
  LocalitySegment,
} from '@/lib/domain/types';

export interface CampaignRow {
  id: string;
  slug: string;
  sponsorId: string;
  sponsorNameAr: string;
  sponsorLogoUrl: string | null;
  fixtureId: string | null;
  titleAr: string;
  benefitAr: string | null;
  descriptionAr: string | null;
  termsAr: string | null;
  imageUrl: string | null;
  eligibilityMode: CampaignEligibilityMode;
  revealTiming: BenefitRevealTiming;
  complianceMode: ComplianceMode;
  legalApprovalStatus: LegalApprovalStatus;
  minAge: number;
  allowedLocalities: LocalitySegment[];
  expiresAt: string | null;
  isActive: boolean;
  isTest: boolean;
}

function mapRow(r: Record<string, unknown>): CampaignRow {
  const sponsor = (r.sponsor as Record<string, unknown> | null) ?? {};
  return {
    id: r.id as string,
    slug: r.slug as string,
    sponsorId: r.sponsor_id as string,
    sponsorNameAr: (sponsor.name_ar as string) ?? '',
    sponsorLogoUrl: (sponsor.logo_url as string) ?? null,
    fixtureId: (r.fixture_id as string) ?? null,
    titleAr: r.title_ar as string,
    benefitAr: (r.benefit_ar as string) ?? null,
    descriptionAr: (r.description_ar as string) ?? null,
    termsAr: (r.terms_ar as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    eligibilityMode: r.eligibility_mode as CampaignEligibilityMode,
    revealTiming: r.reveal_timing as BenefitRevealTiming,
    complianceMode: r.compliance_mode as ComplianceMode,
    legalApprovalStatus: r.legal_approval_status as LegalApprovalStatus,
    minAge: r.min_age as number,
    allowedLocalities: (r.allowed_localities as LocalitySegment[]) ?? [],
    expiresAt: (r.expires_at as string) ?? null,
    isActive: Boolean(r.is_active),
    isTest: Boolean(r.is_test),
  };
}

export async function getCampaignBySlug(slug: string): Promise<CampaignRow | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('campaign')
    .select('*, sponsor:sponsor_id ( name_ar, logo_url )')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return null;
  const row = mapRow(data as Record<string, unknown>);
  if (row.isTest && !isTestDataAllowed()) return null;
  return row;
}
