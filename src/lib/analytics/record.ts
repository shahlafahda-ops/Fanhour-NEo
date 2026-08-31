import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { isTestDataAllowed } from '@/lib/config/env.server';
import { sanitizeProps, type AnalyticsEvent } from './events';

/**
 * Authoritative server-side event recorder. Analytics must never block a
 * supporter action, so failures are swallowed (logged, not thrown) — see
 * prompt §62.
 */
export async function recordEvent(evt: AnalyticsEvent): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getAdminClient();
    await supabase.from('event').insert({
      name: evt.name,
      anonymous_session_id: evt.anonymousSessionId ?? null,
      supporter_id: evt.supporterId ?? null,
      fixture_id: evt.fixtureId ?? null,
      campaign_id: evt.campaignId ?? null,
      sponsor_id: evt.sponsorId ?? null,
      merchant_id: evt.merchantId ?? null,
      merchant_location_id: evt.merchantLocationId ?? null,
      source: evt.source ?? null,
      props: sanitizeProps(evt.props),
      is_test: isTestDataAllowed(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics] failed to record event', evt.name, err);
  }
}

/**
 * Record an event at most once per (name, identity, fixture).
 *
 * Server-rendered pages re-run on every refresh; without this guard a simple
 * page reload would inflate view metrics and corrupt time-to-first-value.
 */
export async function recordEventOnce(
  evt: AnalyticsEvent & { fixtureId?: string | null },
): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getAdminClient();
    let q = supabase.from('event').select('id', { head: true, count: 'exact' }).eq('name', evt.name);
    if (evt.supporterId) q = q.eq('supporter_id', evt.supporterId);
    else if (evt.anonymousSessionId) q = q.eq('anonymous_session_id', evt.anonymousSessionId);
    else return;
    if (evt.fixtureId) q = q.eq('fixture_id', evt.fixtureId);

    const { count } = await q;
    if ((count ?? 0) > 0) return;
    await recordEvent(evt);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics] recordEventOnce failed', evt.name, err);
  }
}
