'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicConfig } from '@/lib/config/env';

/**
 * Browser Supabase client. Holds only the anon key. Used by the ops/merchant
 * portals for the auth session; fan-facing writes go through server API routes.
 */
export function getBrowserClient() {
  return createBrowserClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey);
}
