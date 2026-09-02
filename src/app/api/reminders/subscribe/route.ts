import { NextResponse } from 'next/server';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { getSupporterState } from '@/lib/identity/supporter';
import { subscribeToReminders } from '@/lib/data/reminders';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';
import { getFlags } from '@/lib/data/flags';

/**
 * Opt a just-verified supporter into matchweek reminders. Verification
 * (phone capture) happens via the existing /api/otp/* routes right before
 * this is called — there is no channel to an anonymous cookie, so this
 * requires an already-verified identity.
 */
export async function POST() {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const flags = await getFlags();
  if (!flags.notification_timing.enabled) {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }

  const supporter = await getSupporterState();
  if (!supporter.supporterId || !supporter.isVerified) {
    return NextResponse.json({ error: 'verification_required' }, { status: 401 });
  }

  const supabase = getAdminClient();
  await supabase.from('consent').insert({
    supporter_id: supporter.supporterId,
    type: 'reminder',
    policy_version: serverConfig.privacyPolicyVersion,
    granted: true,
    source: 'reminder_opt_in',
  });

  const subscription = await subscribeToReminders(
    supporter.supporterId,
    serverConfig.privacyPolicyVersion,
  );

  await recordEvent({
    name: EVENTS.reminder_consent_given,
    supporterId: supporter.supporterId,
  });

  return NextResponse.json({ ok: true, state: subscription.state });
}
