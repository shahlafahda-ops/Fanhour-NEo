import { BrandHeader, Card } from '@/components/ui';
import { getCampaignBySlug } from '@/lib/data/campaigns';
import { serverConfig } from '@/lib/config/env.server';
import { AR } from '@/lib/i18n/ar';

export const dynamic = 'force-dynamic';

export default async function CampaignRulesPage({
  params,
}: {
  params: { campaignSlug: string };
}) {
  const campaign = await getCampaignBySlug(params.campaignSlug);
  return (
    <div className="app-shell">
      <BrandHeader testMode={campaign?.isTest} />
      <main className="flex-1 px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold">{AR.benefit.terms}</h1>
        {campaign ? (
          <Card className="space-y-3">
            <div className="font-semibold">{campaign.titleAr}</div>
            <div className="text-sm text-content-secondary">{campaign.sponsorNameAr}</div>
            {campaign.termsAr ? (
              <p className="text-sm text-content-secondary whitespace-pre-line">
                {campaign.termsAr}
              </p>
            ) : (
              <div className="text-state-warn text-sm font-semibold">
                REQUIRES_APPROVED_LEGAL_COPY
              </div>
            )}
            <p className="text-xs text-content-muted">النسخة: {serverConfig.termsVersion}</p>
          </Card>
        ) : (
          <Card>
            <p className="text-content-secondary">{AR.benefit.unavailable}</p>
          </Card>
        )}
      </main>
    </div>
  );
}
