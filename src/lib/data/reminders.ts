import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { isTestDataAllowed } from '@/lib/config/env.server';
import { assignHoldoutArm, type HoldoutArm } from '@/lib/domain/reminder';

export interface ReminderSubscriptionRow {
  id: string;
  supporterId: string;
  state: 'active' | 'withdrawn';
  holdoutArm: HoldoutArm;
}

export async function getReminderSubscription(
  supporterId: string,
): Promise<ReminderSubscriptionRow | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('reminder_subscription')
    .select('id, supporter_id, state, holdout_arm')
    .eq('supporter_id', supporterId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    supporterId: data.supporter_id as string,
    state: data.state as 'active' | 'withdrawn',
    holdoutArm: data.holdout_arm as HoldoutArm,
  };
}

/**
 * Opt a verified supporter in. The holdout arm is assigned ONCE, the first
 * time a supporter subscribes, and is never recomputed on resubscribe — that
 * is what keeps the causal experiment valid.
 */
export async function subscribeToReminders(
  supporterId: string,
  consentVersion: string,
): Promise<ReminderSubscriptionRow> {
  const supabase = getAdminClient();
  const existing = await getReminderSubscription(supporterId);
  if (existing) {
    await supabase
      .from('reminder_subscription')
      .update({ state: 'active', consent_version: consentVersion, withdrawn_at: null })
      .eq('id', existing.id);
    return { ...existing, state: 'active' };
  }

  const holdoutArm = assignHoldoutArm(Math.random());
  const { data } = await supabase
    .from('reminder_subscription')
    .insert({
      supporter_id: supporterId,
      consent_version: consentVersion,
      holdout_arm: holdoutArm,
      state: 'active',
    })
    .select('id, supporter_id, state, holdout_arm')
    .single();
  return {
    id: data!.id as string,
    supporterId: data!.supporter_id as string,
    state: data!.state as 'active' | 'withdrawn',
    holdoutArm: data!.holdout_arm as HoldoutArm,
  };
}

export async function unsubscribeFromReminders(supporterId: string): Promise<boolean> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('reminder_subscription')
    .update({ state: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('supporter_id', supporterId)
    .eq('state', 'active')
    .select('id')
    .maybeSingle();
  return Boolean(data);
}

/** The phone number to send to. Never logged, never returned to the client. */
export async function getSupporterPhone(supporterId: string): Promise<string | null> {
  if (!hasSupabase()) return null;
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('supporter_contact')
    .select('phone_e164')
    .eq('supporter_id', supporterId)
    .maybeSingle();
  return (data?.phone_e164 as string) ?? null;
}

export interface FixtureCadenceCandidate {
  id: string;
  slug: string;
  opponentAr: string;
  kickoffAt: string;
  status: string;
  resolvedAt: string | null;
}

/**
 * Fixtures whose reminder cadence could plausibly still be due: kickoff
 * within the last 2 days (covers a same-day 'resolution' slot) through 3
 * days out (covers the T-48h slot). Bounded so this stays a cheap query.
 */
export async function getFixturesForReminderCadence(
  now: Date,
): Promise<FixtureCadenceCandidate[]> {
  if (!hasSupabase()) return [];
  const supabase = getAdminClient();
  const from = new Date(now.getTime() - 2 * 24 * 3600_000).toISOString();
  const to = new Date(now.getTime() + 3 * 24 * 3600_000).toISOString();
  let q = supabase
    .from('fixture')
    .select('id, slug, opponent_ar, kickoff_at, status, resolved_at')
    .gte('kickoff_at', from)
    .lte('kickoff_at', to)
    .neq('status', 'cancelled')
    .order('kickoff_at', { ascending: true });
  if (!isTestDataAllowed()) q = q.eq('is_test', false);
  const { data } = await q;
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    opponentAr: r.opponent_ar as string,
    kickoffAt: r.kickoff_at as string,
    status: r.status as string,
    resolvedAt: (r.resolved_at as string) ?? null,
  }));
}

export interface ActiveSubscriptionForSend {
  subscriptionId: string;
  supporterId: string;
  holdoutArm: HoldoutArm;
}

/** All active (non-withdrawn) subscriptions — the send loop's candidate pool. */
export async function getActiveReminderSubscriptions(): Promise<ActiveSubscriptionForSend[]> {
  if (!hasSupabase()) return [];
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('reminder_subscription')
    .select('id, supporter_id, holdout_arm')
    .eq('state', 'active');
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    subscriptionId: r.id as string,
    supporterId: r.supporter_id as string,
    holdoutArm: r.holdout_arm as HoldoutArm,
  }));
}

/** Existing log rows for one subscription across the candidate fixtures (for dedup + cap). */
export async function getNotificationLogForSubscription(
  subscriptionId: string,
  fixtureIds: readonly string[],
): Promise<{ fixtureId: string; cadenceSlot: string; outcome: string }[]> {
  if (!hasSupabase() || fixtureIds.length === 0) return [];
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('notification_log')
    .select('fixture_id, cadence_slot, outcome')
    .eq('reminder_subscription_id', subscriptionId)
    .in('fixture_id', fixtureIds as string[]);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    fixtureId: r.fixture_id as string,
    cadenceSlot: r.cadence_slot as string,
    outcome: r.outcome as string,
  }));
}

export interface NotificationLogInsert {
  reminderSubscriptionId: string;
  fixtureId: string;
  cadenceSlot: string;
  templateKey: string;
  templateVersion: string;
  channel: string;
  outcome: 'sent' | 'deferred' | 'failed' | 'skipped_holdout' | 'skipped_cap';
  scheduledAt: string;
  sentAt?: string | null;
  deferredUntil?: string | null;
  providerRef?: string | null;
  error?: string | null;
}

/** Best-effort log write; a duplicate (unique constraint) is treated as already-handled. */
export async function recordNotification(entry: NotificationLogInsert): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from('notification_log').insert({
    reminder_subscription_id: entry.reminderSubscriptionId,
    fixture_id: entry.fixtureId,
    cadence_slot: entry.cadenceSlot,
    template_key: entry.templateKey,
    template_version: entry.templateVersion,
    channel: entry.channel,
    outcome: entry.outcome,
    scheduled_at: entry.scheduledAt,
    sent_at: entry.sentAt ?? null,
    deferred_until: entry.deferredUntil ?? null,
    provider_ref: entry.providerRef ?? null,
    error: entry.error ?? null,
  });
}
