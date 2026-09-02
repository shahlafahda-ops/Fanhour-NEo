'use server';

import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps, type OpsIdentity } from '@/lib/auth/guards';
import { serverConfig, isTestDataAllowed } from '@/lib/config/env.server';
import { opsFail } from '@/lib/ops/formError';

const PATH = '/ops/fixtures';

async function audit(
  actor: OpsIdentity,
  action: string,
  objectType: string,
  objectId: string | null,
  after: Record<string, unknown>,
) {
  const supabase = getAdminClient();
  await supabase.from('audit_log').insert({
    actor_id: actor.opsUserId,
    actor_role: actor.role,
    action,
    object_type: objectType,
    object_id: objectId,
    after,
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

/** Create a fixture (prompt §33). Cutoff defaults to N minutes before kickoff. */
export async function createFixture(formData: FormData) {
  const actor = await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();

  const opponent = String(formData.get('opponent') ?? '').trim();
  const competition = String(formData.get('competition') ?? '').trim();
  const hazemSide = String(formData.get('hazemSide') ?? 'home') as 'home' | 'away';
  const kickoffLocal = String(formData.get('kickoff') ?? ''); // datetime-local (Riyadh)
  const plannedTouchpoints = formData.getAll('plannedTouchpoints').map(String);
  if (!opponent || !competition || !kickoffLocal) {
    opsFail(PATH, 'يرجى تعبئة الخصم والبطولة وموعد المباراة');
  }
  if (plannedTouchpoints.length === 0) {
    opsFail(PATH, 'يرجى اختيار قناة توزيع مخططة واحدة على الأقل');
  }

  // Interpret the datetime-local input as Asia/Riyadh (UTC+3, no DST).
  const kickoff = new Date(`${kickoffLocal}:00+03:00`);
  const cutoff = new Date(kickoff.getTime() - serverConfig.defaultCutoffMinutes * 60_000);
  const open = new Date(kickoff.getTime() - 3 * 24 * 60 * 60_000); // opens 3 days before

  const { data: club } = await supabase.from('club').select('id').eq('slug', 'alhazem').single();
  const baseSlug = slugify(`${opponent}-${kickoffLocal}`) || `fixture-${Date.now()}`;

  const { data, error } = await supabase
    .from('fixture')
    .insert({
      club_id: club!.id,
      slug: baseSlug,
      opponent_ar: opponent,
      competition_ar: competition,
      hazem_side: hazemSide,
      kickoff_at: kickoff.toISOString(),
      prediction_open_at: open.toISOString(),
      cutoff_at: cutoff.toISOString(),
      status: 'open',
      is_test: isTestDataAllowed() ? String(formData.get('isTest')) === 'on' : false,
    })
    .select('id')
    .single();

  if (error) opsFail(PATH, error.message);

  await supabase.from('distribution_touchpoint').insert(
    plannedTouchpoints.map((channel) => ({
      fixture_id: data.id,
      channel,
      status: 'scheduled',
    })),
  );

  await audit(actor, 'fixture.create', 'fixture', data.id as string, { opponent, competition });
  revalidatePath('/ops/fixtures');
  return;
}

/** Resolve a fixture and grade predictions idempotently (prompt §34). */
export async function resolveFixture(formData: FormData) {
  const actor = await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();

  const fixtureId = String(formData.get('fixtureId') ?? '');
  const hazemScore = Number(formData.get('hazemScore'));
  const opponentScore = Number(formData.get('opponentScore'));
  const deliveredTouchpoints = formData.getAll('deliveredTouchpoints').map(String);
  if (!fixtureId || !Number.isInteger(hazemScore) || !Number.isInteger(opponentScore)) {
    opsFail(PATH, 'يرجى إدخال نتيجة صحيحة لكلا الفريقين');
  }
  // Only fixtures with PLANNED touchpoints require a delivered confirmation —
  // a fixture predating this feature (no planned rows) has nothing to confirm.
  const { count: plannedCount } = await supabase
    .from('distribution_touchpoint')
    .select('id', { head: true, count: 'exact' })
    .eq('fixture_id', fixtureId);
  if ((plannedCount ?? 0) > 0 && deliveredTouchpoints.length === 0) {
    opsFail(PATH, 'يرجى تأكيد قنوات التوزيع التي نُفّذت فعليًا (أو تحديد أن لا شيء نُفّذ)');
  }

  const { error } = await supabase.rpc('resolve_fixture_atomic', {
    p_fixture_id: fixtureId,
    p_hazem_score: hazemScore,
    p_opponent_score: opponentScore,
  });
  if (error) opsFail(PATH, error.message);

  const deliveredChannels = deliveredTouchpoints.filter((c) => c !== 'none');
  if (deliveredChannels.length > 0) {
    await supabase
      .from('distribution_touchpoint')
      .update({ status: 'delivered' })
      .eq('fixture_id', fixtureId)
      .in('channel', deliveredChannels);
  }

  // A5 — measured ops effort, optional per field.
  const minutes = (key: string): number | null => {
    const raw = String(formData.get(key) ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  await supabase
    .from('fixture')
    .update({
      minutes_question_set: minutes('minutesQuestionSet'),
      minutes_verification: minutes('minutesVerification'),
      minutes_resolution: minutes('minutesResolution'),
      minutes_sponsor_reporting: minutes('minutesSponsorReporting'),
    })
    .eq('id', fixtureId);

  await audit(actor, 'fixture.resolve', 'fixture', fixtureId, { hazemScore, opponentScore });
  revalidatePath('/ops/fixtures');
  revalidatePath('/app/alhazem');
  return;
}
