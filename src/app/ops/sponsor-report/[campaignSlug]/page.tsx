import { requireOps } from '@/lib/auth/guards';
import { getSponsorReport } from '@/lib/data/sponsorReport';
import { formatRiyadh } from '@/lib/i18n/format';
import { AR } from '@/lib/i18n/ar';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function SponsorReportPage({
  params,
}: {
  params: { campaignSlug: string };
}) {
  await requireOps(['super_admin', 'ops', 'analyst']);
  const report = await getSponsorReport(params.campaignSlug);

  if (!report) {
    return <p className="text-content-secondary">{AR.sponsorReport.noCampaigns}</p>;
  }

  const answeredCount =
    report.firstVisitShare.yes + report.firstVisitShare.no + report.firstVisitShare.unsure;
  const firstVisitPct =
    answeredCount > 0 ? Math.round((report.firstVisitShare.yes / answeredCount) * 100) : null;

  return (
    <div className="space-y-6 print:text-black print:bg-white max-w-2xl">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">{AR.sponsorReport.heading}</h1>
        <PrintButton label={AR.sponsorReport.print} />
      </div>

      <section className="rounded-card bg-surface-card border border-surface-border p-4 print:border-black print:bg-white">
        <div className="flex items-center gap-3 mb-2">
          {report.sponsorLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.sponsorLogoUrl} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />
          )}
          <h2 className="text-lg font-bold">{report.sponsorNameAr}</h2>
        </div>
      </section>

      <section className="rounded-card bg-surface-card border border-surface-border p-4 space-y-2 print:border-black">
        <h3 className="font-semibold">{AR.sponsorReport.vriTitle}</h3>
        <p className="text-3xl font-bold">{report.vri.vri.toLocaleString('ar')}</p>
        <p className="text-xs text-content-muted">{AR.sponsorReport.vriCaveat}</p>
        <dl className="text-xs text-content-secondary grid grid-cols-3 gap-2 pt-2">
          <div>
            <dt className="text-content-muted">{AR.sponsorReport.registeredFans}</dt>
            <dd className="font-semibold">{report.vri.inputs.registeredFans}</dd>
          </div>
          <div>
            <dt className="text-content-muted">{AR.sponsorReport.activeRate}</dt>
            <dd className="font-semibold">{Math.round(report.vri.inputs.activeRate90d * 100)}٪</dd>
          </div>
          <div>
            <dt className="text-content-muted">{AR.sponsorReport.reachability}</dt>
            <dd className="font-semibold">
              {Math.round(report.vri.inputs.notificationReachability * 100)}٪
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label={AR.sponsorReport.reached} value={report.totals.reached} />
        <Stat label={AR.sponsorReport.participated} value={report.totals.participated} />
        <Stat label={AR.sponsorReport.eligiblePopulation} value={report.totals.eligiblePopulation} />
        <Stat label={AR.sponsorReport.claimed} value={report.totals.claimed} />
        <Stat label={AR.sponsorReport.redeemed} value={report.totals.redeemed} />
        <Stat
          label={AR.sponsorReport.firstVisitShare}
          value={firstVisitPct === null ? '—' : `${firstVisitPct}٪`}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-sm text-content-secondary">
          {AR.sponsorReport.perFixtureBreakdown}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-surface-border print:border-black">
                <th className="py-2 pe-2">{AR.fixture.hazem}</th>
                <th className="py-2 pe-2">{AR.sponsorReport.reached}</th>
                <th className="py-2 pe-2">{AR.sponsorReport.participated}</th>
                <th className="py-2 pe-2">{AR.sponsorReport.eligiblePopulation}</th>
                <th className="py-2 pe-2">{AR.sponsorReport.claimed}</th>
                <th className="py-2 pe-2">{AR.sponsorReport.redeemed}</th>
              </tr>
            </thead>
            <tbody>
              {report.perFixture.map((f) => (
                <tr key={f.fixtureId} className="border-b border-surface-border/50 print:border-black">
                  <td className="py-2 pe-2">
                    {AR.fixture.hazem} × {f.opponentAr}
                    <div className="text-content-muted">{formatRiyadh(f.kickoffAt)}</div>
                  </td>
                  <td className="py-2 pe-2">{f.reached}</td>
                  <td className="py-2 pe-2">{f.participated}</td>
                  <td className="py-2 pe-2">{f.eligiblePopulation}</td>
                  <td className="py-2 pe-2">{f.claimed}</td>
                  <td className="py-2 pe-2">{f.redeemed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card bg-surface-card border border-surface-border p-3 print:border-black">
      <div className="text-xs text-content-muted">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
