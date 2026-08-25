'use server';

import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps } from '@/lib/auth/guards';

export async function createMerchant(formData: FormData) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('missing_name');
  const { data: m, error } = await supabase
    .from('merchant')
    .insert({ name_ar: name })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await supabase.from('merchant_location').insert({ merchant_id: m.id, name_ar: name });
  revalidatePath('/ops/merchants');
  return;
}

/** Create a scoped merchant staff account (auth user + merchant_user). */
export async function createMerchantUser(formData: FormData) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const merchantId = String(formData.get('merchantId') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();
  if (!merchantId || !email || password.length < 8) throw new Error('invalid_input');

  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !created.user) throw new Error(authErr?.message ?? 'auth_failed');

  const { error } = await supabase.from('merchant_user').insert({
    auth_user_id: created.user.id,
    merchant_id: merchantId,
    display_name: displayName || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/ops/merchants');
  return;
}

/** Grant a merchant access to a campaign (scoping). */
export async function grantCampaignAccess(formData: FormData) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const merchantId = String(formData.get('merchantId') ?? '');
  const campaignId = String(formData.get('campaignId') ?? '');
  if (!merchantId || !campaignId) throw new Error('invalid_input');
  const { error } = await supabase
    .from('campaign_merchant')
    .upsert({ merchant_id: merchantId, campaign_id: campaignId });
  if (error) throw new Error(error.message);
  revalidatePath('/ops/merchants');
  return;
}
