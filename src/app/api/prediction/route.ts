import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import {
  anonymousCookieOptions,
  ensureAnonymousCookieValue,
  upsertAnonymousSession,
} from '@/lib/identity/session';
import { getFixtureBySlugOrId } from '@/lib/data/fixtureLookup';
import { fixtureTimes } from '@/lib/data/fixtures';
import { isPredictionEditable } from '@/lib/domain/fixture';
import { computeCommunityDistribution } from '@/lib/domain/community';
import { getCommunityCounts } from '@/lib/data/fixtures';
import { publicConfig } from '@/lib/config/env';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

const Body = z.object({
  fixtureId: z.string().uuid(),
  outcome: z.enum(['hazem_win', 'draw', 'opponent_win']),
});

export async function POST(req: Request) {
  if (!hasSupabase()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const fixture = await getFixtureBySlugOrId(parsed.fixtureId);
  if (!fixture) return NextResponse.json({ error: 'fixture_not_found' }, { status: 404 });

  // SERVER-side eligibility gate — the client clock never decides (prompt §9).
  if (!isPredictionEditable(fixture.status, fixtureTimes(fixture), new Date())) {
    return NextResponse.json({ error: 'predictions_closed' }, { status: 409 });
  }

  const { id: anonId, isNew } = ensureAnonymousCookieValue();
  await upsertAnonymousSession(anonId);

  const supabase = getAdminClient();

  // Is there an existing prediction for this identity + fixture?
  const { data: existing } = await supabase
    .from('prediction')
    .select('id, outcome')
    .eq('fixture_id', fixture.id)
    .eq('anonymous_session_id', anonId)
    .maybeSingle();

  if (existing) {
    if (existing.outcome !== parsed.outcome) {
      await supabase
        .from('prediction')
        .update({ outcome: parsed.outcome, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      await supabase
        .from('prediction_change')
        .insert({ prediction_id: existing.id, outcome: parsed.outcome });
      await recordEvent({
        name: EVENTS.prediction_updated,
        anonymousSessionId: anonId,
        fixtureId: fixture.id,
        props: { prediction_value: parsed.outcome },
      });
    }
  } else {
    const { error } = await supabase.from('prediction').insert({
      fixture_id: fixture.id,
      anonymous_session_id: anonId,
      outcome: parsed.outcome,
      source: 'web',
    });
    if (error) {
      // Unique violation => a race created it; treat as success.
      if (error.code !== '23505') {
        return NextResponse.json({ error: 'submit_failed' }, { status: 500 });
      }
    } else {
      await recordEvent({
        name: EVENTS.prediction_submitted,
        anonymousSessionId: anonId,
        fixtureId: fixture.id,
        source: 'web',
        props: { prediction_value: parsed.outcome, new_vs_returning: isNew ? 'new' : 'returning' },
      });
    }
  }

  const counts = await getCommunityCounts(fixture.id);
  const dist = computeCommunityDistribution(counts, publicConfig.communityMinSample);

  const res = NextResponse.json({
    ok: true,
    outcome: parsed.outcome,
    community: { hasEnoughSample: dist.hasEnoughSample, percentages: dist.percentages },
  });
  if (isNew) {
    const opts = anonymousCookieOptions();
    res.cookies.set(opts.name, anonId, opts);
  }
  return res;
}
