import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { normalizeSaudiMobile, phoneLookupHash } from '@/lib/security/phone';
import {
  generateOtpCode,
  hashOtp,
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  canResend,
} from '@/lib/security/otp';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { getOtpProvider } from '@/lib/otp/provider';
import { randomUUID } from 'node:crypto';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

const Body = z.object({ phone: z.string().min(6).max(20) });

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

  // Abuse protection: at most 5 OTP requests per number per hour (prompt §14).
  const rl = await checkRateLimit(`otp_request:${lookup}`, 5, 3600);
  if (!rl.allowed) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });

  const supabase = getAdminClient();

  // Resend throttle: reject if a very recent challenge exists.
  const { data: recent } = await supabase
    .from('otp_challenge')
    .select('last_sent_at')
    .eq('phone_lookup_hash', lookup)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && !canResend(new Date(recent.last_sent_at as string), new Date())) {
    return NextResponse.json({ error: 'resend_cooldown' }, { status: 429 });
  }

  const challengeId = randomUUID();
  const code = generateOtpCode();
  const codeHash = hashOtp(code, challengeId, serverConfig.hashPepper);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabase.from('otp_challenge').insert({
    id: challengeId,
    phone_lookup_hash: lookup,
    code_hash: codeHash,
    max_attempts: OTP_MAX_ATTEMPTS,
    expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: 'otp_failed' }, { status: 500 });

  const provider = getOtpProvider();
  const sent = await provider.send(e164, code);
  if (!sent.ok) {
    return NextResponse.json({ error: 'delivery_failed', detail: sent.error }, { status: 502 });
  }

  await recordEvent({ name: EVENTS.otp_requested, props: { provider: provider.name } });

  // The OTP is NEVER returned in the response (prompt §14).
  return NextResponse.json({ ok: true, challengeId });
}
