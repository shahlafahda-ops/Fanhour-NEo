/**
 * Source attribution (A2) — pure validation. A week the club forgets to
 * post should be distinguishable from a product problem, so every fan entry
 * route accepts `?src=` and it is persisted on `anonymous_session` at first
 * touch only (never overwritten).
 */
export const ATTRIBUTION_SOURCES = [
  'club_post',
  'whatsapp_broadcast',
  'stadium_qr',
  'sponsor_store',
  'ops_manual',
  'unknown',
] as const;

export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

/** Any value outside the allowed set collapses to 'unknown' — never dropped, never guessed. */
export function normalizeAttributionSource(raw: string | null | undefined): AttributionSource {
  if (raw && (ATTRIBUTION_SOURCES as readonly string[]).includes(raw)) {
    return raw as AttributionSource;
  }
  return 'unknown';
}
