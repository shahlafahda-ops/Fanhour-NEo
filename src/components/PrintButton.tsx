'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-card border border-surface-border px-4 py-2 text-sm"
    >
      {label}
    </button>
  );
}
