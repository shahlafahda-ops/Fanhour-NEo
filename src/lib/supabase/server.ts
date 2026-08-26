import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicConfig } from '@/lib/config/env';
import { hasSupabase } from './admin';

/**
 * Auth-aware Supabase client bound to the request's cookies. Used by the ops
 * and merchant portals so RLS policies (is_ops / merchant_can_access_campaign)
 * apply with the signed-in user's identity.
 */
export function getServerClient() {
  if (!hasSupabase()) {
    throw new Error('Supabase is not configured.');
  }
  const cookieStore = cookies();
  return createServerClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; safe to ignore — the
          // middleware/session refresh handles cookie writes.
        }
      },
    },
  });
}
