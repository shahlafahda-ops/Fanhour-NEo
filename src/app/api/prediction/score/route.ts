import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getAnonymousSessionId } from '@/lib/identity/session';
import { getFixtureBySlugOrId } from '@/lib/data/fixtureLookup';
import { fixtureTimes } from '@/lib/data/fixtures';
import { isPredictionEditable } from '@/lib/domain/fixture';

const Body = z.object({
  fixtureId: z.string().uuid(),
  exactHazemScore: z.number().int().min(0).max(30),
  exactOpponentScore: z.number().int().min(0).max(30),
});

// Optional depth (prompt §11) — never blocks core participation or benefit.
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const anonId = getAnonymousSessionId();
  if (!anonId) return NextResponse.json({ error: 'no_session' }, { status: 400 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const fixture = await getFixtureBySlugOrId(parsed.fixtureId);
  if (!fixture) return NextResponse.json({ error: 'fixture_not_found' }, { status: 404 });
  if (!isPredictionEditable(fixture.status, fixtureTimes(fixture), new Date())) {
    return NextResponse.json({ error: 'predictions_closed' }, { status: 409 });
  }

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('prediction')
    .update({
      exact_hazem_score: parsed.exactHazemScore,
      exact_opponent_score: parsed.exactOpponentScore,
      updated_at: new Date().toISOString(),
    })
    .eq('fixture_id', fixture.id)
    .eq('anonymous_session_id', anonId);

  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
