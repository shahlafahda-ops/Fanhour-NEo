import * as React from 'react';
import { AR } from '@/lib/i18n/ar';

/** FanHour × الحزم header. FanHour owns the digital experience (prompt §58). */
export function BrandHeader({ testMode }: { testMode?: boolean }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
      <div className="flex items-center gap-2">
        <span
          className="text-lg font-bold tracking-tight bg-gradient-to-l from-brand-green to-brand-purple bg-clip-text text-transparent"
          aria-label="FanHour"
        >
          {AR.brand.fanhour}
        </span>
        <span aria-hidden className="text-content-muted">
          {AR.brand.cross}
        </span>
        {/* Al Hazem crest placeholder — replace with approved club asset. */}
        <span
          className="inline-flex items-center gap-1.5 text-content-primary font-semibold"
          aria-label="Al Hazem"
        >
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-full bg-hazem-primary ring-1 ring-white/20"
          />
          {AR.brand.hazem}
        </span>
      </div>
      {testMode ? <TestBadge /> : null}
    </header>
  );
}

export function TestBadge() {
  return (
    <span className="rounded-full bg-state-warn/15 text-state-warn text-xs px-2 py-1 font-medium">
      {AR.common.testBadge}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-surface-card border border-surface-border p-4 ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-card bg-brand-green text-surface-base font-bold text-lg py-3.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:brightness-95 ${className}`}
    >
      {children}
    </button>
  );
}

export function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface-card2 border border-surface-border px-3 py-4 text-center">
      <div className="text-2xl font-bold text-content-primary">{value}</div>
      <div className="text-xs text-content-secondary mt-1">{label}</div>
    </div>
  );
}

/** Success/failure never communicated by colour alone (prompt §61). */
export function ResultPill({ correct }: { correct: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
        correct ? 'bg-state-success/15 text-state-success' : 'bg-content-muted/15 text-content-secondary'
      }`}
    >
      <span aria-hidden>{correct ? '✓' : '—'}</span>
      {correct ? AR.result.correct : AR.result.incorrect}
    </span>
  );
}
