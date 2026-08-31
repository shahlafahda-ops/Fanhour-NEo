'use server';

import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps } from '@/lib/auth/guards';
import { isTestDataAllowed } from '@/lib/config/env.server';
import { campaignCanGoLive } from '@/lib/domain/eligibility';
import type { ComplianceMode } from '@/lib/domain/types';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}

export async function createSponsor(formData: FormData) {
  const actor = await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const name = String(formData.get('name') ?? '').trim();
  const commercialType = String(formData.get('commercialType') ?? 'paid');
  const logoUrl = String(formData.get('logoUrl') ?? '').trim();
  if (!name) throw new Error('missing_name');
  const { data, error } = await supabase
    .from('sponsor')
    .insert({ name_ar: name, commercial_type: commercialType, logo_url: logoUrl || null })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await supabase.from('audit_log').insert({
    actor_id: actor.opsUserId,
    actor_role: actor.role,
    action: 'sponsor.create',
    object_type: 'sponsor',
    object_id: data.id,
    after: { name },
  });
  revalidatePath('/ops/campaigns');
  return;
}

export async function createCampaign(formData: FormData) {
  const actor = await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();

  const title = String(formData.get('title') ?? '').trim();
  const sponsorId = String(formData.get('sponsorId') ?? '');
  const fixtureId = String(formData.get('fixtureId') ?? '') || null;
  const benefit = String(formData.get('benefit') ?? '').trim();
  const terms = String(formData.get('terms') ?? '').trim();
  const imageUrl = String(formData.get('imageUrl') ?? '').trim();
  const complianceMode = String(formData.get('complianceMode') ?? 'participation_benefit') as ComplianceMode;
  const revealTiming = String(formData.get('revealTiming') ?? 'post_result');
  const issueCapRaw = String(formData.get('issueCap') ?? '');
  const expires = String(formData.get('expires') ?? '');

  if (!title || !sponsorId) throw new Error('missing_fields');

  const { data, error } = await supabase
    .from('campaign')
    .insert({
      slug: slugify(title) || `campaign-${Date.now()}`,
      sponsor_id: sponsorId,
      fixture_id: fixtureId,
      title_ar: title,
      benefit_ar: benefit || null,
      terms_ar: terms || null,
      image_url: imageUrl || null,
      compliance_mode: complianceMode,
      reveal_timing: revealTiming,
      issue_cap: issueCapRaw ? Number(issueCapRaw) : null,
      expires_at: expires ? new Date(`${expires}:00+03:00`).toISOString() : null,
      is_active: false,
      is_test: isTestDataAllowed() ? String(formData.get('isTest')) === 'on' : false,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await supabase.from('audit_log').insert({
    actor_id: actor.opsUserId,
    actor_role: actor.role,
    action: 'campaign.create',
    object_type: 'campaign',
    object_id: data.id,
    after: { title, complianceMode },
  });
  revalidatePath('/ops/campaigns');
  return;
}

/** Activate a campaign only when launch-ready (guards regulated prizes). */
export async function setCampaignActive(formData: FormData) {
  const actor = await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const campaignId = String(formData.get('campaignId') ?? '');
  const activate = String(formData.get('activate')) === 'true';

  const { data: c } = await supabase.from('campaign').select('*').eq('id', campaignId).single();
  if (!c) throw new Error('not_found');

  if (activate) {
    const check = campaignCanGoLive({
      complianceMode: c.compliance_mode,
      legalApprovalStatus: c.legal_approval_status,
      hasFixture: Boolean(c.fixture_id),
      hasSponsor: Boolean(c.sponsor_id),
      hasBenefitDescription: Boolean(c.benefit_ar),
      hasTerms: Boolean(c.terms_ar),
      hasExpiry: Boolean(c.expires_at),
      issueCap: c.issue_cap,
    });
    if (!check.canGoLive) throw new Error(`missing:${check.missing.join(',')}`);
  }

  const { error } = await supabase
    .from('campaign')
    .update({ is_active: activate, updated_at: new Date().toISOString() })
    .eq('id', campaignId);
  if (error) throw new Error(error.message);

  await supabase.from('audit_log').insert({
    actor_id: actor.opsUserId,
    actor_role: actor.role,
    action: activate ? 'campaign.activate' : 'campaign.deactivate',
    object_type: 'campaign',
    object_id: campaignId,
    after: { is_active: activate },
  });
  revalidatePath('/ops/campaigns');
  return;
}
