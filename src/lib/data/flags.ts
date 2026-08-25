import 'server-only';
import { getAdminClient, hasSupabase } from '@/lib/supabase/admin';
import { FLAG_DEFAULTS, resolveFlags, type FlagKey, type FlagState } from '@/lib/config/flags';

export async function getFlags(): Promise<Record<FlagKey, FlagState>> {
  if (!hasSupabase()) return { ...FLAG_DEFAULTS };
  try {
    const supabase = getAdminClient();
    const { data } = await supabase.from('feature_flag').select('key, enabled, value');
    return resolveFlags((data as { key: string; enabled: boolean; value: unknown }[]) ?? []);
  } catch {
    return { ...FLAG_DEFAULTS };
  }
}
