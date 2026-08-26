import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/config/env';
import { serverConfig } from '@/lib/config/env.server';

/**
 * Service-role Supabase client. SERVER ONLY — bypasses RLS. Never import from
 * client components. `import 'server-only'` makes a client-side import a build
 * error (prompt §5, §51: service role never exposed to browser).
 */
let cached: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(
    publicConfig.supabaseUrl &&
      serverConfig.supabaseServiceRoleKey &&
      publicConfig.supabaseAnonKey,
  );
}

export function getAdminClient(): SupabaseClient {
  if (!hasSupabase()) {
    throw new Error('Supabase is not configured (missing URL or service role key).');
  }
  if (!cached) {
    cached = createClient(publicConfig.supabaseUrl, serverConfig.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
