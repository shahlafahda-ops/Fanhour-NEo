import Link from 'next/link';
import { BrandHeader, Card } from '@/components/ui';
import { BenefitClaim } from '@/components/BenefitClaim';
import { getCampaignBySlug } from '@/lib/data/campaigns';
import { getSupporterState } from '@/lib/identity/supporter';
import { getFlags } from '@/lib/data/flags';
import { formatRiyadhDate } from '@/lib/i18n/format';
import { publicConfig } from '@/lib/config/env';
import { AR } from '@/lib/i18n/ar';

export const dynamic = 'force-dynamic';

export default async function BenefitPage({ params }: { params: { campaignSlug: string } }) {
  const campaign = await getCampaignBySlug(params.campaignSlug);
  const flags = await getFlags();

  return (
    <div className="app-shell">
      <BrandHeader testMode={campaign?.isTest} />
      <main className="flex-1 px-4 py-5 space-y-5">
        <h1 className="text-2xl font-bold text-center">{AR.benefit.heading}</h1>

        {!campaign || !campaign.isActive || !flags.benefit_enabled.enabled ? (
          <Card className="text-center">
            <p className="text-content-secondary">{AR.benefit.unavailable}</p>
          </Card>
        ) : (
          <>
            <ClaimSection campaignSlug={params.campaignSlug} campaign={campaign} />
            <div className="text-center space-x-3 space-x-reverse">
              <Link
                href={`/campaign-rules/${campaign.slug}`}
                className="text-brand-green text-sm underline"
              >
                {AR.benefit.terms}
              </Link>
              <Link href="/app/alhazem" className="text-content-muted text-sm underline">
                {AR.common.back}
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

async function ClaimSection({
  campaignSlug,
  campaign,
}: {
  campaignSlug: string;
  campaign: NonNullable<Awaited<ReturnType<typeof getCampaignBySlug>>>;
}) {
  const supporter = await getSupporterState();
  return (
    <BenefitClaim
      data={{
        campaignSlug,
        sponsorNameAr: campaign.sponsorNameAr,
        titleAr: campaign.titleAr,
        benefitAr: campaign.benefitAr,
        descriptionAr: campaign.descriptionAr,
        termsAr: campaign.termsAr,
        validityLabel: campaign.expiresAt ? formatRiyadhDate(campaign.expiresAt) : null,
        alreadyVerified: supporter.isVerified,
        appUrl: publicConfig.appUrl,
      }}
    />
  );
}
