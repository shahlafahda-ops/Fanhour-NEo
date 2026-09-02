import { NextResponse } from 'next/server';
import { hasSupabase } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { getFlags } from '@/lib/data/flags';
import {
  getFixturesForReminderCadence,
  getActiveReminderSubscriptions,
  getNotificationLogForSubscription,
  getSupporterPhone,
  recordNotification,
} from '@/lib/data/reminders';
import {
  CADENCE_SLOTS, cadenceSlotTime, deferIfQuietHours, isCadenceSlotDue,
  REMINDER_TEMPLATES, type CadenceSlot,
} from '@/lib/domain/reminder';
import { renderReminderMessage } from '@/lib/i18n/reminders';
import { formatRiyadh } from '@/lib/i18n/format';
import { getNotifyProvider } from '@/lib/notify/provider';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

/**
 * Send-loop entry point. Not wired to any automatic scheduler by this repo —
 * an external cron (Netlify Scheduled Function, cron-job.org, etc.) must call
 * this on an interval (every 15–30 min is plenty, cadence slots are hours
 * apart) with the shared secret. See docs/LAUNCH_CHECKLIST.md.
 */
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  if (!serverConfig.cronSecret || req.headers.get('x-cron-secret') !== serverConfig.cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const flags = await getFlags();
  if (!flags.notification_timing.enabled) {
    return NextResponse.json({ ok: true, skipped: 'flag_disabled' });
  }

  const now = new Date();
  const [fixtures, subscriptions] = await Promise.all([
    getFixturesForReminderCadence(now),
    getActiveReminderSubscriptions(),
  ]);
  const fixtureIds = fixtures.map((f) => f.id);

  let sent = 0;
  let skippedHoldout = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    const logs = await getNotificationLogForSubscription(subscription.subscriptionId, fixtureIds);
    const loggedSlots = new Set(logs.map((l) => `${l.fixtureId}:${l.cadenceSlot}`));
    const sentCountByFixture = new Map<string, number>();
    for (const l of logs) {
      if (l.outcome === 'sent') {
        sentCountByFixture.set(l.fixtureId, (sentCountByFixture.get(l.fixtureId) ?? 0) + 1);
      }
    }

    for (const fixture of fixtures) {
      const times = {
        kickoffAt: new Date(fixture.kickoffAt),
        resolvedAt: fixture.resolvedAt ? new Date(fixture.resolvedAt) : null,
      };

      for (const slot of CADENCE_SLOTS) {
        const alreadyLogged = loggedSlots.has(`${fixture.id}:${slot}`);
        const naturalTime = cadenceSlotTime(times, slot);
        const effectiveTime = naturalTime ? deferIfQuietHours(naturalTime) : null;
        const due = isCadenceSlotDue({
          scheduledAt: effectiveTime,
          now,
          alreadyLogged,
          sendsSoFarForFixture: sentCountByFixture.get(fixture.id) ?? 0,
        });
        if (!due) continue;

        const template = REMINDER_TEMPLATES[slot];

        if (subscription.holdoutArm === 'holdout') {
          await recordNotification({
            reminderSubscriptionId: subscription.subscriptionId,
            fixtureId: fixture.id,
            cadenceSlot: slot,
            templateKey: template.key,
            templateVersion: template.version,
            channel: 'unifonic_sms',
            outcome: 'skipped_holdout',
            scheduledAt: naturalTime!.toISOString(),
          });
          skippedHoldout += 1;
          continue;
        }

        const phone = await getSupporterPhone(subscription.supporterId);
        const message = renderMessageForSlot(slot, fixture.opponentAr, fixture.kickoffAt);

        if (!phone || !message) {
          await recordNotification({
            reminderSubscriptionId: subscription.subscriptionId,
            fixtureId: fixture.id,
            cadenceSlot: slot,
            templateKey: template.key,
            templateVersion: template.version,
            channel: 'unifonic_sms',
            outcome: 'failed',
            scheduledAt: naturalTime!.toISOString(),
            error: !phone ? 'no_phone' : 'template_params',
          });
          failed += 1;
          continue;
        }

        const provider = getNotifyProvider();
        const result = await provider.send(phone, message);
        await recordNotification({
          reminderSubscriptionId: subscription.subscriptionId,
          fixtureId: fixture.id,
          cadenceSlot: slot,
          templateKey: template.key,
          templateVersion: template.version,
          channel: 'unifonic_sms',
          outcome: result.ok ? 'sent' : 'failed',
          scheduledAt: naturalTime!.toISOString(),
          sentAt: result.ok ? now.toISOString() : null,
          providerRef: result.providerRef ?? null,
          error: result.error ?? null,
        });
        if (result.ok) {
          sent += 1;
          await recordEvent({
            name: EVENTS.notification_sent,
            supporterId: subscription.supporterId,
            fixtureId: fixture.id,
            props: { cadence_slot: slot, template_key: template.key },
          });
        } else {
          failed += 1;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skippedHoldout, failed });
}

function renderMessageForSlot(
  slot: CadenceSlot,
  opponentAr: string,
  kickoffAtIso: string,
): string | null {
  if (slot === 't_minus_48h') {
    return renderReminderMessage(slot, { opponentAr, kickoffLabel: formatRiyadh(kickoffAtIso) });
  }
  return renderReminderMessage(slot, { opponentAr });
}
