'use client';

import * as React from 'react';
import { AR } from '@/lib/i18n/ar';
import { Card, PrimaryButton } from '@/components/ui';
import type { PredictionOutcome } from '@/lib/domain/types';
import { CommentaryBanner } from '@/components/CommentaryBanner';
import { classifyRarity, type CommentaryReaction } from '@/lib/domain/commentary';

export interface FixtureViewData {
  fixtureId: string;
  slug: string;
  opponentAr: string;
  competitionAr: string;
  venueLabel: string;
  kickoffAt: string;
  effectiveStatus: 'scheduled' | 'open' | 'locked' | 'resolved' | 'cancelled';
  existingOutcome: PredictionOutcome | null;
  communityEnabled: boolean;
  optionalDepthEnabled: boolean;
}

interface CommunityResult {
  hasEnoughSample: boolean;
  percentages: Record<PredictionOutcome, number> | null;
  chosenSharePct?: number | null;
}

const CHOICES: { key: PredictionOutcome; label: (opp: string) => string }[] = [
  { key: 'hazem_win', label: () => AR.fixture.hazem },
  { key: 'draw', label: () => AR.fixture.draw },
  { key: 'opponent_win', label: (opp) => opp },
];

export function FixtureView({ data }: { data: FixtureViewData }) {
  const [outcome, setOutcome] = React.useState<PredictionOutcome | null>(data.existingOutcome);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [community, setCommunity] = React.useState<CommunityResult | null>(null);
  const [reaction, setReaction] = React.useState<CommentaryReaction | null>(null);
  const editable = data.effectiveStatus === 'open';

  async function submit(choice: PredictionOutcome) {
    if (!editable || submitting) return;
    setError(null);
    setSubmitting(true);
    const previous = outcome;
    setOutcome(choice); // optimistic
    try {
      const res = await fetch('/api/prediction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fixtureId: data.fixtureId, outcome: choice }),
      });
      if (!res.ok) throw new Error('submit_failed');
      const json = (await res.json()) as {
        community: CommunityResult | null;
        reaction: CommentaryReaction | null;
      };
      if (json.community) setCommunity(json.community);
      setReaction(json.reaction ?? null);
    } catch {
      setOutcome(previous);
      setReaction(null);
      setError(AR.prediction.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (data.effectiveStatus === 'scheduled') {
    return (
      <Card>
        <p className="text-content-secondary text-center py-4">
          {AR.fixture.predictionsNotOpen}
        </p>
      </Card>
    );
  }

  const locked = data.effectiveStatus === 'locked' || data.effectiveStatus === 'cancelled';

  return (
    <section aria-labelledby="predict-heading" className="space-y-4">
      <h2 id="predict-heading" className="text-xl font-bold text-center">
        {AR.fixture.whoWins}
      </h2>

      <div role="radiogroup" aria-label={AR.fixture.whoWins} className="grid grid-cols-1 gap-3">
        {CHOICES.map((c) => {
          const selected = outcome === c.key;
          return (
            <button
              key={c.key}
              role="radio"
              aria-checked={selected}
              disabled={!editable}
              onClick={() => submit(c.key)}
              className={`flex items-center justify-between rounded-card border px-4 py-4 text-lg font-semibold transition-colors ${
                selected
                  ? 'border-brand-green bg-brand-greenDim text-content-primary'
                  : 'border-surface-border bg-surface-card text-content-secondary'
              } ${editable ? 'active:brightness-110' : 'opacity-70 cursor-not-allowed'}`}
            >
              <span>{c.label(data.opponentAr)}</span>
              <span aria-hidden className={selected ? 'text-brand-green' : 'text-content-muted'}>
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {outcome && (
        <p className="text-center text-brand-green font-medium" role="status">
          {AR.prediction.chose(CHOICES.find((c) => c.key === outcome)!.label(data.opponentAr))}
        </p>
      )}

      {editable && outcome && (
        <p className="text-center text-content-muted text-sm">
          {AR.prediction.canChangeUntilCutoff}
        </p>
      )}

      {locked && (
        <p className="text-center text-content-secondary text-sm">
          {AR.fixture.predictionsClosed}
        </p>
      )}

      {error && (
        <p className="text-center text-state-danger text-sm" role="alert">
          {error}
        </p>
      )}

      <CommentaryBanner reaction={reaction} />

      {data.communityEnabled && community && (
        <CommunityFeedback community={community} opponentAr={data.opponentAr} />
      )}

      {data.optionalDepthEnabled && outcome && editable && (
        <OptionalDepth fixtureId={data.fixtureId} opponentAr={data.opponentAr} />
      )}
    </section>
  );
}

function CommunityFeedback({
  community,
  opponentAr,
}: {
  community: CommunityResult;
  opponentAr: string;
}) {
  if (!community.hasEnoughSample || !community.percentages) {
    return (
      <Card>
        <p className="text-content-secondary text-center text-sm">{AR.community.tooEarly}</p>
      </Card>
    );
  }
  const p = community.percentages;
  const rows: { label: string; value: number }[] = [
    { label: AR.fixture.hazem, value: p.hazem_win },
    { label: AR.fixture.draw, value: p.draw },
    { label: opponentAr, value: p.opponent_win },
  ];
  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-content-secondary">{AR.community.heading}</h3>
      <CommunityInterpretation sharePct={community.chosenSharePct ?? null} />
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-sm mb-1">
            <span>{r.label}</span>
            <span className="tabular-nums text-content-secondary">{r.value}٪</span>
          </div>
          <div className="h-2 rounded-full bg-surface-card2 overflow-hidden">
            <div
              className="h-full bg-brand-green"
              style={{ width: `${r.value}%` }}
              aria-hidden
            />
          </div>
        </div>
      ))}
    </Card>
  );
}

/**
 * One plain-language reading of where the supporter sits. The catchphrase layer
 * handles genuinely rare calls; this stays neutral so it can always be shown.
 */
function CommunityInterpretation({ sharePct }: { sharePct: number | null }) {
  if (sharePct === null) return null;
  const band = classifyRarity(sharePct);
  const text =
    band === 'majority'
      ? AR.community.withMajority
      : band === 'balanced'
        ? AR.community.balanced
        : band === 'minority'
          ? AR.community.minority(sharePct)
          : AR.community.strongMinority(sharePct);
  return <p className="text-sm text-content-secondary text-center pb-1">{text}</p>;
}

function OptionalDepth({ fixtureId, opponentAr }: { fixtureId: string; opponentAr: string }) {
  const [hazem, setHazem] = React.useState('');
  const [opp, setOpp] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/prediction/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fixtureId,
          exactHazemScore: Number(hazem),
          exactOpponentScore: Number(opp),
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold">{AR.prediction.optionalDepthTitle}</h3>
      <p className="text-xs text-content-muted">{AR.prediction.optionalDepthHint}</p>
      <div className="flex items-center justify-center gap-3">
        <label className="text-sm flex flex-col items-center gap-1">
          <span>{AR.fixture.hazem}</span>
          <input
            inputMode="numeric"
            value={hazem}
            onChange={(e) => setHazem(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-14 text-center rounded-lg bg-surface-card2 border border-surface-border py-2"
            aria-label={`${AR.fixture.hazem} ${AR.prediction.optionalDepthTitle}`}
          />
        </label>
        <span aria-hidden className="text-content-muted">
          –
        </span>
        <label className="text-sm flex flex-col items-center gap-1">
          <span>{opponentAr}</span>
          <input
            inputMode="numeric"
            value={opp}
            onChange={(e) => setOpp(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-14 text-center rounded-lg bg-surface-card2 border border-surface-border py-2"
            aria-label={`${opponentAr} ${AR.prediction.optionalDepthTitle}`}
          />
        </label>
      </div>
      <PrimaryButton
        onClick={save}
        disabled={saving || hazem === '' || opp === ''}
        className="!text-base !py-2.5"
      >
        {saved ? '✓' : AR.prediction.saveScore}
      </PrimaryButton>
    </Card>
  );
}
