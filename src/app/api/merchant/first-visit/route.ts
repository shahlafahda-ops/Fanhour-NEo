import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { getMerchantIdentity } from '@/lib/auth/guards';

const Body = z.object({
  claimId: z.string().uuid(),
  firstVisit: z.enum(['yes', 'no', 'unsure']),
});

/**
 * A4 — one optional, skippable, no-PII tap right after a successful
 * redemption: "is this your first visit?" Never blocking, never required.
 */
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const merchant = await getMerchantIdentity();
  if (!merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data: log } = await supabase
    .from('redemption_log')
    .select('id, merchant_id')
    .eq('claim_id', parsed.claimId)
    .eq('outcome', 'redeemed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log || log.merchant_id !== merchant.merchantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await supabase
    .from('redemption_log')
    .update({ first_visit: parsed.firstVisit })
    .eq('id', log.id);

  return NextResponse.json({ ok: true });
}
