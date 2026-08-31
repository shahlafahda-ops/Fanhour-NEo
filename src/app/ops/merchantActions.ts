'use server';

import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps } from '@/lib/auth/guards';
import { opsFail } from '@/lib/ops/formError';

const PATH = '/ops/merchants';

export async function createMerchant(formData: FormData) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) opsFail(PATH, 'اسم المتجر مطلوب');
  const { data: m, error } = await supabase
    .from('merchant')
    .insert({ name_ar: name })
    .select('id')
    .single();
  if (error) opsFail(PATH, error.message);
  await supabase.from('merchant_location').insert({ merchant_id: m.id, name_ar: name });
  revalidatePath(PATH);
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
  if (!merchantId || !email || password.length < 8) {
    opsFail(PATH, 'يرجى اختيار المتجر وإدخال بريد إلكتروني صحيح وكلمة مرور من 8 أحرف على الأقل');
  }

  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    opsFail(PATH, authErr?.message ?? 'تعذر إنشاء حساب الدخول');
  }

  const { error } = await supabase.from('merchant_user').insert({
    auth_user_id: created.user.id,
    merchant_id: merchantId,
    display_name: displayName || null,
  });
  if (error) opsFail(PATH, error.message);
  revalidatePath(PATH);
  return;
}

/** Grant a merchant access to a campaign (scoping). */
export async function grantCampaignAccess(formData: FormData) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const merchantId = String(formData.get('merchantId') ?? '');
  const campaignId = String(formData.get('campaignId') ?? '');
  if (!merchantId || !campaignId) opsFail(PATH, 'يرجى اختيار المتجر والحملة');
  const { error } = await supabase
    .from('campaign_merchant')
    .upsert({ merchant_id: merchantId, campaign_id: campaignId });
  if (error) opsFail(PATH, error.message);
  revalidatePath(PATH);
  return;
}
