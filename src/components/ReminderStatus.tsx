'use client';

import * as React from 'react';
import { AR } from '@/lib/i18n/ar';
import { Card } from '@/components/ui';

/** Withdrawal control for an active reminder subscription (record page only). */
export function ReminderStatus({ initiallyActive }: { initiallyActive: boolean }) {
  const [active, setActive] = React.useState(initiallyActive);
  const [busy, setBusy] = React.useState(false);
  const [withdrawn, setWithdrawn] = React.useState(false);

  if (!active) {
    return withdrawn ? (
      <p className="text-center text-content-muted text-xs">{AR.reminder.unsubscribedNote}</p>
    ) : null;
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const res = await fetch('/api/reminders/unsubscribe', { method: 'POST' });
      if (res.ok) {
        setActive(false);
        setWithdrawn(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex items-center justify-between gap-3 text-sm">
      <span className="text-content-secondary">{AR.reminder.activeNote}</span>
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="text-state-danger underline shrink-0"
      >
        {AR.reminder.unsubscribeCta}
      </button>
    </Card>
  );
}
