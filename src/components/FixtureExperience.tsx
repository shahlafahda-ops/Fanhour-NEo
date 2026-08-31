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
import { getSupporterRecord } from '@/lib/data/record';
import { StatusCard } from '@/components/StatusCard';
import { CommentaryBanner } from '@/components/CommentaryBanner';
import { evaluateCommentaryReaction } from '@/lib/domain/commentary';
import { computeXp, resolveRank, didRankAdvance } from '@/lib/domain/progression';
import { recordEventOnce } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';
import { resolveCurrentIdentity } from '@/lib/identity/current';
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

  // Paired with `first_value_reached` to measure time to first value. Recorded
  // once per identity+fixture so a page refresh cannot inflate the funnel.
  const viewer = await resolveCurrentIdentity();
  await recordEventOnce({
    name: EVENTS.fixture_viewed,
    anonymousSessionId: viewer.anonymousSessionId,
    supporterId: viewer.supporterId,
    fixtureId: fixture.id,
  });

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

  // No prediction on this fixture: keep the screen factual and point forward.
  if (!mine) {
    return (
      <section className="space-y-4" aria-labelledby="result-heading">
        <h2 id="result-heading" className="text-xl font-bold text-center">
          {AR.result.heading}
        </h2>
        <FinalScoreCard fixture={fixture} opponentAr={opponentAr} />
        <Card>
          <p className="text-center text-content-secondary text-sm">{AR.record.empty}</p>
        </Card>
        {next && <NextFixtureCard next={next} />}
      </section>
    );
  }

  const record = await getSupporterRecord();
  const identity = await resolveCurrentIdentity();
  const entry = record.entries.find((e) => e.fixtureId === fixture.id) ?? null;

  // Rank movement is derived, not persisted: recompute XP without this fixture.
  const xpAfter = record.xp;
  const xpBefore = computeXp(
    record.entries
      .filter((e) => e.fixtureId !== fixture.id)
      .map((e) => ({
        fixtureId: e.fixtureId,
        isCorrect: e.isCorrect,
        isExactCorrect: e.isExactCorrect,
      })),
  );
  const advanced = didRankAdvance(xpBefore, xpAfter);

  // Community standing of the supporter's own selection.
  const counts = await getCommunityCounts(fixture.id);
  const dist = computeCommunityDistribution(counts, publicConfig.communityMinSample);
  const chosenSharePct = dist.percentages ? dist.percentages[mine.outcome] : null;

  const recentGraded = record.entries.filter((e) => e.isCorrect !== null).slice(0, 5);
  const reaction = evaluateCommentaryReaction({
    moment: 'post_resolution',
    resolution: {
      outcomeCorrect: mine.isCorrect === true,
      exactCorrect: entry?.isExactCorrect ?? false,
    },
    community: { hasEnoughSample: dist.hasEnoughSample, chosenSharePct },
    performance: {
      recentCorrect: recentGraded.filter((e) => e.isCorrect === true).length,
      recentWindow: recentGraded.length,
      gradedCount: record.gradedCount,
    },
    rankAdvancedToAr: advanced ? resolveRank(xpAfter).rank.nameAr : null,
  });

  // Enrich the exact-score reaction with the two scorelines it talks about.
  const enriched =
    reaction && reaction.reactionKey === 'BEL_MILLIMETER' && entry
      ? {
          ...reaction,
          data: {
            predicted: `${entry.predictedHazem}-${entry.predictedOpponent}`,
            actual: `${fixture.hazemScore}-${fixture.opponentScore}`,
          },
        }
      : reaction;

  await recordEventOnce({
    name: EVENTS.first_resolution_viewed,
    anonymousSessionId: identity.anonymousSessionId,
    supporterId: identity.supporterId,
    fixtureId: fixture.id,
  });
  if (enriched) {
    await recordEventOnce({
      name: EVENTS.commentary_reaction_shown,
      anonymousSessionId: identity.anonymousSessionId,
      supporterId: identity.supporterId,
      fixtureId: fixture.id,
      props: { reaction_key: enriched.reactionKey, reason: enriched.reason },
    });
  }
  if (advanced) {
    await recordEventOnce({
      name: EVENTS.rank_advanced,
      anonymousSessionId: identity.anonymousSessionId,
      supporterId: identity.supporterId,
      fixtureId: fixture.id,
      props: { rank: resolveRank(xpAfter).rank.key },
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="result-heading">
      <h2 id="result-heading" className="text-xl font-bold text-center">
        {AR.result.heading}
      </h2>

      {/* 1 — final result */}
      <FinalScoreCard fixture={fixture} opponentAr={opponentAr} />

      {/* 2–4 — the supporter's call, correctness, exact-score outcome */}
      <Card className="space-y-2 text-center">
        <div className="text-sm text-content-muted">{AR.result.yourPrediction}</div>
        <div className="text-lg font-semibold">{outcomeLabel(mine.outcome, opponentAr)}</div>
        {entry?.predictedHazem !== null && entry?.predictedOpponent !== null && entry && (
          <div className="text-sm text-content-secondary tabular-nums" dir="ltr">
            {entry.predictedHazem} – {entry.predictedOpponent}
          </div>
        )}
        <div className="flex justify-center pt-1">
          <ResultPill correct={mine.isCorrect === true} />
        </div>
        {/* 5 — XP earned this fixture */}
        {entry && (
          <div className="text-brand-green font-semibold tabular-nums">
            {AR.skill.xpEarned(entry.xpEarned)}
          </div>
        )}
      </Card>

      {/* 11 — commentary reaction (at most one, and only when earned) */}
      <CommentaryBanner reaction={enriched} />

      {/* 6–9 — accuracy, rank, progress to next rank, streak */}
      <StatusCard progress={record.progress} streak={record.streak} compact />
      {record.accuracyPct !== null && (
        <p className="text-center text-sm text-content-secondary">
          {AR.skill.accuracy}: <span className="text-content-primary font-semibold">{record.accuracyPct}٪</span>
        </p>
      )}

      {/* 10 — community comparison */}
      {dist.hasEnoughSample && chosenSharePct !== null && (
        <Card>
          <p className="text-center text-sm text-content-secondary">
            {AR.community.strongMinority(chosenSharePct)}
          </p>
        </Card>
      )}

      {/* 13 — next fixture */}
      {next && <NextFixtureCard next={next} />}
    </section>
  );
}

function FinalScoreCard({ fixture, opponentAr }: { fixture: FixtureRow; opponentAr: string }) {
  return (
    <Card className="text-center space-y-1">
      <div className="text-sm text-content-muted">{AR.result.finalScore}</div>
      <div className="text-4xl font-bold tabular-nums" dir="ltr">
        {fixture.hazemScore} – {fixture.opponentScore}
      </div>
      <div className="text-sm text-content-secondary">
        {AR.fixture.hazem} × {opponentAr}
      </div>
    </Card>
  );
}

function NextFixtureCard({ next }: { next: FixtureRow }) {
  return (
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
  );
}
