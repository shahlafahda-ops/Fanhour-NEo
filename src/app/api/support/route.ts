import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { recordEvent } from '@/lib/analytics/record';
import { EVENTS } from '@/lib/analytics/events';

const Body = z.object({
  fallbackCode: z.string().max(20).optional(),
  campaignId: z.string().uuid().optional(),
  failureType: z.string().max(60).optional(),
  note: z.string().max(500).optional(),
});

// Real, actionable support ticket (prompt §64) — no fake "we will contact you".
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = getAdminClient();
  let claimId: string | null = null;
  if (parsed.fallbackCode) {
    const { data } = await supabase
      .from('claim')
      .select('id')
      .eq('fallback_code', parsed.fallbackCode.toUpperCase())
      .maybeSingle();
    claimId = (data?.id as string) ?? null;
  }

  const { data: ticket, error } = await supabase
    .from('support_ticket')
    .insert({
      claim_id: claimId,
      campaign_id: parsed.campaignId ?? null,
      failure_type: parsed.failureType ?? null,
      note: parsed.note ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: 'support_failed' }, { status: 500 });

  await recordEvent({ name: EVENTS.support_requested, campaignId: parsed.campaignId ?? null });
  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
