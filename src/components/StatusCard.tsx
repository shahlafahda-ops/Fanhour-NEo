import { Card } from '@/components/ui';
import { AR } from '@/lib/i18n/ar';
import type { RankProgress } from '@/lib/domain/progression';
import type { StreakSummary } from '@/lib/domain/streak';

/**
 * Supporter status: rank, XP and progress toward the next rank.
 * This is a football-credibility ladder — never a wallet, balance or currency.
 */
export function StatusCard({
  progress,
  streak,
  compact = false,
}: {
  progress: RankProgress;
  streak?: StreakSummary;
  compact?: boolean;
}) {
  const pct = progress.progressPct;
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs text-content-muted">{AR.status.rank}</div>
          <div className="text-xl font-bold text-content-primary">{progress.rank.nameAr}</div>
        </div>
        <div className="text-left" dir="ltr">
          <div className="text-2xl font-bold tabular-nums text-brand-green">{progress.xp}</div>
          <div className="text-xs text-content-muted text-right">{AR.status.xp}</div>
        </div>
      </div>

      <div
        className="h-2 rounded-full bg-surface-card2 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={AR.status.heading}
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-green to-brand-purple"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-sm text-content-secondary">
        {progress.nextRank
          ? AR.status.toNextRank(progress.xpToNext, progress.nextRank.nameAr)
          : AR.status.highestRank}
      </p>

      {streak && streak.current > 0 && (
        <p className="text-sm text-content-secondary">
          {AR.status.streak}:{' '}
          <span className="text-content-primary font-semibold">
            {streak.current === 1 ? AR.status.streakOne : AR.status.streakMatches(streak.current)}
          </span>
        </p>
      )}

      {!compact && <p className="text-xs text-content-muted pt-1">{AR.status.explainer}</p>}
    </Card>
  );
}
