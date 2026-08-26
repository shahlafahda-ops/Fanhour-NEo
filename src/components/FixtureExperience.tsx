import * as React from 'react';
import Link from 'next/link';
import { AR } from '@/lib/i18n/ar';
import { formatRiyadh } from '@/lib/i18n/format';
import { BrandHeader, Card, ResultPill, StatTile } from '@/components/ui';
import { FixtureView } from '@/components/FixtureView';
import {
  fixtureEffectiveStatus,
  getCommunityCounts,
  getNextFixtureAfter,
  type FixtureRow,
} from '@/lib/data/fixtures';
import { getMyPrediction } from '@/lib/data/predictions';
import { getFlags } from '@/lib/data/flags';
import { computeCommunityDistribution } from '@/lib/domain/community';
import { publicConfig } from '@/lib/config/env';
import type { PredictionOutcome } from '@/lib/domain/types';

function outcomeLabel(o: PredictionOutcome, opponentAr: string): string {
  if (o === 'hazem_win') return AR.fixture.hazem;
  if (o === 'draw') return AR.fixture.draw;
  return opponentAr;
}

/**
 * Full fixture experience: renders the prediction UI while open, and the
 * post-match resolution screen once resolved. Server component — the client
 * clock never decides state (prompt §9, §19).
 */
export async function FixtureExperience({ fixture }: { fixture: FixtureRow }) {
  const status = fixtureEffectiveStatus(fixture);
  const flags = await getFlags();
  const mine = await getMyPrediction(fixture.id);

  const venueLabel = fixture.hazemSide === 'home' ? AR.fixture.venueHome : AR.fixture.venueAway;

  return (
    <div className="app-shell">
      <BrandHeader testMode={fixture.isTest} />
      <main className="flex-1 px-4 py-5 space-y-5">
        <FixtureHeader fixture={fixture} venueLabel={venueLabel} status={status} />

        {status === 'resolved' ? (
          <ResolvedView fixture={fixture} opponentAr={fixture.opponentAr} mine={mine} />
        ) : (
          <FixtureView
            data={{
              fixtureId: fixture.id,
              slug: fixture.slug,
              opponentAr: fixture.opponentAr,
              competitionAr: fixture.competitionAr,
              venueLabel,
              kickoffAt: fixture.kickoffAt,
              effectiveStatus: status,
              existingOutcome: mine?.outcome ?? null,
              communityEnabled: flags.community_feedback.enabled,
              optionalDepthEnabled: flags.optional_depth.enabled,
            }}
          />
        )}

        {status === 'locked' && <LockedCommunity fixtureId={fixture.id} opponentAr={fixture.opponentAr} />}

        <div className="text-center">
          <Link href="/app/alhazem/record" className="text-brand-green text-sm underline">
            {AR.result.seeRecord}
          </Link>
        </div>
      </main>
    </div>
  );
}

function FixtureHeader({
  fixture,
  venueLabel,
  status,
}: {
  fixture: FixtureRow;
  venueLabel: string;
  status: string;
}) {
  return (
    <Card className="text-center space-y-2">
      <div className="text-xs text-content-muted">{fixture.competitionAr}</div>
      <div className="flex items-center justify-center gap-3 text-2xl font-bold">
        <span>{AR.fixture.hazem}</span>
        <span className="text-content-muted text-base">{AR.brand.cross}</span>
        <span>{fixture.opponentAr}</span>
      </div>
      <div className="text-content-secondary text-sm">{formatRiyadh(fixture.kickoffAt)}</div>
      <div className="text-content-muted text-xs">{venueLabel}</div>
      {status === 'open' && (
        <div className="inline-block rounded-full bg-brand-greenDim text-brand-green text-xs px-3 py-1 mt-1">
          {AR.fixture.predictCta}
        </div>
      )}
    </Card>
  );
}

async function LockedCommunity({ fixtureId, opponentAr }: { fixtureId: string; opponentAr: string }) {
  const counts = await getCommunityCounts(fixtureId);
  const dist = computeCommunityDistribution(counts, publicConfig.communityMinSample);
  if (!dist.hasEnoughSample || !dist.percentages) return null;
  return (
    <Card>
      <p className="text-center text-sm text-content-secondary">
        {AR.community.hazemPct(dist.percentages.hazem_win)}
      </p>
    </Card>
  );
}

async function ResolvedView({
  fixture,
  opponentAr,
  mine,
}: {
  fixture: FixtureRow;
  opponentAr: string;
  mine: { outcome: PredictionOutcome; isCorrect: boolean | null } | null;
}) {
  const next = await getNextFixtureAfter(fixture.kickoffAt);
  return (
    <section className="space-y-4" aria-labelledby="result-heading">
      <h2 id="result-heading" className="text-xl font-bold text-center">
        {AR.result.heading}
      </h2>

      <Card className="text-center space-y-1">
        <div className="text-sm text-content-muted">{AR.result.finalScore}</div>
        <div className="text-4xl font-bold tabular-nums">
          {fixture.hazemScore} – {fixture.opponentScore}
        </div>
        <div className="text-sm text-content-secondary">
          {AR.fixture.hazem} × {opponentAr}
        </div>
      </Card>

      {mine ? (
        <Card className="space-y-2 text-center">
          <div className="text-sm text-content-muted">{AR.result.yourPrediction}</div>
          <div className="text-lg font-semibold">{outcomeLabel(mine.outcome, opponentAr)}</div>
          <div className="flex justify-center pt-1">
            <ResultPill correct={mine.isCorrect === true} />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-center text-content-secondary text-sm">{AR.record.empty}</p>
        </Card>
      )}

      {next && (
        <Card className="text-center space-y-2">
          <div className="text-sm text-content-muted">{AR.result.nextFixture}</div>
          <div className="font-semibold">
            {AR.fixture.hazem} × {next.opponentAr}
          </div>
          <Link
            href={`/app/alhazem/match/${next.slug}`}
            className="inline-block rounded-card bg-brand-green text-surface-base font-bold px-5 py-2.5 mt-1"
          >
            {AR.fixture.predictCta}
          </Link>
        </Card>
      )}
    </section>
  );
}
