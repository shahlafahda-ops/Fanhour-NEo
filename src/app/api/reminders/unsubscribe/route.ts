import { NextResponse } from 'next/server';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { getSupporterState } from '@/lib/identity/supporter';
import { unsubscribeFromReminders } from '@/lib/data/reminders';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

/** Withdraw reminder consent. Stops sends immediately — no further cadence slot fires. */
export async function POST() {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const supporter = await getSupporterState();
  if (!supporter.supporterId || !supporter.isVerified) {
    return NextResponse.json({ error: 'verification_required' }, { status: 401 });
  }

  const withdrawn = await unsubscribeFromReminders(supporter.supporterId);
  if (!withdrawn) return NextResponse.json({ error: 'not_subscribed' }, { status: 404 });

  const supabase = getAdminClient();
  await supabase.from('consent').insert({
    supporter_id: supporter.supporterId,
    type: 'reminder',
    policy_version: serverConfig.privacyPolicyVersion,
    granted: false,
    source: 'record_page',
  });

  await recordEvent({
    name: EVENTS.reminder_consent_withdrawn,
    supporterId: supporter.supporterId,
  });

  return NextResponse.json({ ok: true });
}
