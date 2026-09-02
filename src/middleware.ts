import { NextResponse, type NextRequest } from 'next/server';
import { normalizeAttributionSource } from '@/lib/domain/attribution';

/**
 * A2: capture `?src=` on fan entry routes into a short-lived first-party
 * cookie — first touch only, never overwritten. The actual persistence onto
 * `anonymous_session.source` happens server-side (in session.ts) the next
 * time that table is written, so this stays a cheap edge-only cookie stamp
 * with no DB access and no service-role exposure at the edge.
 */
const SRC_COOKIE = 'fh_src';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const srcParam = req.nextUrl.searchParams.get('src');
  if (!srcParam || req.cookies.has(SRC_COOKIE)) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.cookies.set(SRC_COOKIE, normalizeAttributionSource(srcParam), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return res;
}

export const config = {
  matcher: ['/app/alhazem', '/app/alhazem/:path*', '/pilot'],
};
