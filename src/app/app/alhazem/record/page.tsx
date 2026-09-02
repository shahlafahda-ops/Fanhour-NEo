import Link from 'next/link';
import { BrandHeader, Card, StatTile, ResultPill } from '@/components/ui';
import { StatusCard } from '@/components/StatusCard';
import { ReminderStatus } from '@/components/ReminderStatus';
import { getSupporterRecord, type RecordEntry } from '@/lib/data/record';
import { getSupporterState } from '@/lib/identity/supporter';
import { getReminderSubscription } from '@/lib/data/reminders';
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
  const supporter = await getSupporterState();
  const reminderSubscription = supporter.supporterId
    ? await getReminderSubscription(supporter.supporterId)
    : null;

  return (
    <div className="app-shell">
      <BrandHeader />
      <main className="flex-1 px-4 py-5 space-y-6">
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
            {/* A — Status */}
            <section aria-labelledby="status-h" className="space-y-3">
              <h2 id="status-h" className="text-sm font-semibold text-content-secondary">
                {AR.status.heading}
              </h2>
              <StatusCard progress={record.progress} streak={record.streak} />
            </section>

            {/* B — Football skill */}
            <section aria-labelledby="skill-h" className="space-y-3">
              <h2 id="skill-h" className="text-sm font-semibold text-content-secondary">
                {AR.skill.heading}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  label={AR.skill.accuracy}
                  value={record.accuracyPct === null ? '—' : `${record.accuracyPct}٪`}
                />
                <StatTile label={AR.skill.correct} value={record.correctCount} />
                <StatTile label={AR.skill.exactHits} value={record.exactCount} />
              </div>
              {record.streak.best > 0 && (
                <p className="text-center text-content-muted text-xs">
                  {AR.status.bestStreak}: {AR.status.streakMatches(record.streak.best)}
                </p>
              )}
            </section>

            {/* C — Participation */}
            <section aria-labelledby="part-h" className="space-y-3">
              <h2 id="part-h" className="text-sm font-semibold text-content-secondary">
                {AR.record.heading}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label={AR.record.fixturesParticipated}
                  value={record.fixturesParticipated}
                />
                <StatTile label={AR.skill.graded} value={record.gradedCount} />
              </div>
              {record.firstParticipationAt && (
                <p className="text-center text-content-muted text-xs">
                  {AR.record.firstParticipation}: {formatRiyadhDate(record.firstParticipationAt)}
                </p>
              )}
            </section>

            <ReminderStatus initiallyActive={reminderSubscription?.state === 'active'} />

            {/* D — Prediction history */}
            <section aria-label={AR.record.heading} className="space-y-3">
              {record.entries.map((e) => (
                <HistoryCard key={e.fixtureId} entry={e} />
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

/**
 * History rows stay factual. The commentary phrase is a live result moment, so
 * it is deliberately NOT repeated here — only the exact-score fact is marked.
 */
function HistoryCard({ entry }: { entry: RecordEntry }) {
  const resolved = entry.isCorrect !== null;
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {AR.fixture.hazem} × {entry.opponentAr}
          </div>
          <div className="text-xs text-content-muted">
            {formatRiyadhDate(entry.kickoffAt)} · {AR.result.yourPrediction}:{' '}
            {outcomeLabel(entry.outcome, entry.opponentAr)}
          </div>
        </div>
        {resolved && <ResultPill correct={entry.isCorrect === true} />}
      </div>

      {resolved && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-content-secondary tabular-nums" dir="ltr">
            {entry.hazemScore} – {entry.opponentScore}
          </span>
          <span className="flex items-center gap-2">
            {entry.isExactCorrect && (
              <span className="text-brand-green font-semibold">
                {AR.skill.exactHits} ✓
              </span>
            )}
            <span className="text-content-muted tabular-nums">
              {AR.skill.xpEarned(entry.xpEarned)}
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}
