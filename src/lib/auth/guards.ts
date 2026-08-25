import 'server-only';
import { getServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import type { OperationsRole } from '@/lib/domain/types';

export interface OpsIdentity {
  authUserId: string;
  opsUserId: string;
  role: OperationsRole;
  displayName: string | null;
}

export interface MerchantIdentity {
  authUserId: string;
  merchantUserId: string;
  merchantId: string;
  merchantLocationId: string | null;
  displayName: string | null;
}

/**
 * Resolve the signed-in ops user, or null. Every ops server action must call
 * this and check the role — authorization is enforced server-side, never by
 * hidden UI (prompt §52).
 */
export async function getOpsIdentity(): Promise<OpsIdentity | null> {
  const supabase = getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getAdminClient();
  const { data } = await admin
    .from('ops_user')
    .select('id, role, display_name, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;

  return {
    authUserId: user.id,
    opsUserId: data.id as string,
    role: data.role as OperationsRole,
    displayName: (data.display_name as string) ?? null,
  };
}

export function opsHasRole(identity: OpsIdentity, roles: OperationsRole[]): boolean {
  return roles.includes(identity.role);
}

export async function requireOps(roles?: OperationsRole[]): Promise<OpsIdentity> {
  const id = await getOpsIdentity();
  if (!id) throw new Error('unauthorized');
  if (roles && !opsHasRole(id, roles)) throw new Error('forbidden');
  return id;
}

/** Resolve the signed-in merchant user, or null. */
export async function getMerchantIdentity(): Promise<MerchantIdentity | null> {
  const supabase = getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getAdminClient();
  const { data } = await admin
    .from('merchant_user')
    .select('id, merchant_id, merchant_location_id, display_name, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;

  return {
    authUserId: user.id,
    merchantUserId: data.id as string,
    merchantId: data.merchant_id as string,
    merchantLocationId: (data.merchant_location_id as string) ?? null,
    displayName: (data.display_name as string) ?? null,
  };
}
