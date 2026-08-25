import Link from 'next/link';
import { BrandHeader, Card, StatTile, ResultPill } from '@/components/ui';
import { getSupporterRecord } from '@/lib/data/record';
import { formatRiyadhDate } from '@/lib/i18n/format';
import { AR } from '@/lib/i18n/ar';

export const dynamic = 'force-dynamic';

function outcomeLabel(o: string, opponentAr: string): string {
  if (o === 'hazem_win') return AR.fixture.hazem;
  if (o === 'draw') return AR.fixture.draw;
  return opponentAr;
}

export default async function RecordPage() {
  const record = await getSupporterRecord();

  return (
    <div className="app-shell">
      <BrandHeader />
      <main className="flex-1 px-4 py-5 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{AR.record.heading}</h1>
          <p className="text-content-secondary text-sm">{AR.record.subtitle}</p>
        </div>

        {record.fixturesParticipated === 0 ? (
          <Card className="text-center space-y-3">
            <p className="text-content-secondary text-sm">{AR.record.empty}</p>
            <Link href="/app/alhazem" className="text-brand-green underline text-sm">
              {AR.fixture.predictCta}
            </Link>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatTile label={AR.record.fixturesParticipated} value={record.fixturesParticipated} />
              <StatTile label={AR.record.correctPredictions} value={record.correctCount} />
              <StatTile
                label={AR.record.accuracy}
                value={record.accuracyPct === null ? '—' : `${record.accuracyPct}٪`}
              />
            </div>

            {record.firstParticipationAt && (
              <p className="text-center text-content-muted text-xs">
                {AR.record.firstParticipation}: {formatRiyadhDate(record.firstParticipationAt)}
              </p>
            )}

            <section className="space-y-3">
              {record.entries.map((e) => (
                <Card key={e.fixtureId} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {AR.fixture.hazem} × {e.opponentAr}
                    </div>
                    <div className="text-xs text-content-muted">
                      {formatRiyadhDate(e.kickoffAt)} · {outcomeLabel(e.outcome, e.opponentAr)}
                    </div>
                  </div>
                  {e.isCorrect !== null && <ResultPill correct={e.isCorrect} />}
                </Card>
              ))}
            </section>
          </>
        )}

        <div className="text-center">
          <Link href="/app/alhazem" className="text-brand-green text-sm underline">
            {AR.common.back}
          </Link>
        </div>
      </main>
    </div>
  );
}
