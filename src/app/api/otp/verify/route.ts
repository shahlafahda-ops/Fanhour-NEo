import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { normalizeSaudiMobile, phoneLookupHash } from '@/lib/security/phone';
import { verifyOtp, isOtpExpired } from '@/lib/security/otp';
import {
  anonymousCookieOptions,
  ensureAnonymousCookieValue,
  upsertAnonymousSession,
} from '@/lib/identity/session';
import { verifyAndMerge } from '@/lib/identity/merge';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

const Body = z.object({
  phone: z.string().min(6).max(20),
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const e164 = normalizeSaudiMobile(parsed.phone);
  if (!e164) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  const lookup = phoneLookupHash(e164, serverConfig.hashPepper);

  const supabase = getAdminClient();
  const { data: challenge } = await supabase
    .from('otp_challenge')
    .select('*')
    .eq('id', parsed.challengeId)
    .eq('phone_lookup_hash', lookup)
    .maybeSingle();

  if (!challenge) return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  if (challenge.consumed) return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  if (isOtpExpired(new Date(challenge.created_at as string), new Date())) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }
  if ((challenge.attempts as number) >= (challenge.max_attempts as number)) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 });
  }

  const ok = verifyOtp(
    parsed.code,
    challenge.code_hash as string,
    parsed.challengeId,
    serverConfig.hashPepper,
  );

  if (!ok) {
    await supabase
      .from('otp_challenge')
      .update({ attempts: (challenge.attempts as number) + 1 })
      .eq('id', parsed.challengeId);
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  }

  // Single-use: consume immediately.
  await supabase.from('otp_challenge').update({ consumed: true }).eq('id', parsed.challengeId);

  const { id: anonId, isNew } = ensureAnonymousCookieValue();
  await upsertAnonymousSession(anonId);
  const supporterId = await verifyAndMerge(e164, anonId);

  await recordEvent({
    name: EVENTS.otp_verified,
    anonymousSessionId: anonId,
    supporterId,
  });

  const res = NextResponse.json({ ok: true, supporterId });
  if (isNew) {
    const opts = anonymousCookieOptions();
    res.cookies.set(opts.name, anonId, opts);
  }
  return res;
}
