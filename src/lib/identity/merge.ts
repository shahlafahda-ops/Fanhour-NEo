import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';
import { serverConfig } from '@/lib/config/env.server';
import { phoneLookupHash } from '@/lib/security/phone';

/**
 * Cross-device identity merge (prompt §15). Given a verified phone and the
 * current anonymous session, resolve-or-create the supporter and fold the
 * anonymous activity into it. Contact PII lives only in supporter_contact,
 * never in behavioural tables.
 *
 * Returns the supporter id.
 */
export async function verifyAndMerge(e164: string, anonymousSessionId: string): Promise<string> {
  const supabase = getAdminClient();
  const lookup = phoneLookupHash(e164, serverConfig.hashPepper);

  // Existing verified supporter for this number?
  const { data: contact } = await supabase
    .from('supporter_contact')
    .select('supporter_id')
    .eq('phone_lookup_hash', lookup)
    .maybeSingle();

  let supporterId: string;
  if (contact) {
    supporterId = contact.supporter_id as string;
  } else {
    const { data: sup, error } = await supabase
      .from('supporter')
      .insert({ is_verified: true })
      .select('id')
      .single();
    if (error || !sup) throw new Error('supporter_create_failed');
    supporterId = sup.id as string;
    await supabase.from('supporter_contact').insert({
      supporter_id: supporterId,
      phone_e164: e164,
      phone_lookup_hash: lookup,
    });
  }

  // Attach the anonymous session and fold its predictions into the supporter.
  await supabase
    .from('anonymous_session')
    .update({ supporter_id: supporterId })
    .eq('id', anonymousSessionId);

  // Move predictions that don't collide with an existing verified prediction
  // (the DB unique index guarantees one qualified prediction per fixture per
  // supporter; on conflict we keep the supporter's existing one).
  const { data: anonPreds } = await supabase
    .from('prediction')
    .select('id, fixture_id')
    .eq('anonymous_session_id', anonymousSessionId)
    .is('supporter_id', null);

  for (const p of (anonPreds as { id: string; fixture_id: string }[]) ?? []) {
    const { data: clash } = await supabase
      .from('prediction')
      .select('id')
      .eq('fixture_id', p.fixture_id)
      .eq('supporter_id', supporterId)
      .maybeSingle();
    if (clash) continue; // supporter already participated in this fixture
    await supabase.from('prediction').update({ supporter_id: supporterId }).eq('id', p.id);
  }

  return supporterId;
}
