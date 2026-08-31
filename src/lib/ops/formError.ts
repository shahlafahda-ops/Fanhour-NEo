import 'server-only';
import { redirect } from 'next/navigation';

/**
 * Redirect back to an ops page with a readable error message instead of
 * letting the exception bubble up. An uncaught throw inside a server action
 * renders Next.js's opaque "Application error: a server-side exception has
 * occurred" screen with no message — unusable for a non-technical ops user
 * mid-pilot-setup who needs to know *what* went wrong (duplicate email,
 * missing field, a Postgres constraint) to fix it and retry.
 */
export function opsFail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
