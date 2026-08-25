/**
 * Centralised analytics event taxonomy (prompt §40, §41).
 *
 * Business-critical events (e.g. redemption_validated, benefit_issued) are
 * recorded AUTHORITATIVELY by the server after the underlying atomic operation
 * — never also emitted from the browser (prompt §42). UI-only telemetry
 * (viewed/clicked/started) may be emitted client-side.
 *
 * PII rule (prompt §41): never attach raw phone, OTP, or sensitive identifiers.
 */

export const EVENTS = {
  fixture_viewed: 'fixture_viewed',
  club_cta_clicked: 'club_cta_clicked',
  prediction_started: 'prediction_started',
  prediction_submitted: 'prediction_submitted',
  prediction_updated: 'prediction_updated',
  community_feedback_viewed: 'community_feedback_viewed',
  result_checked: 'result_checked',
  prediction_resolved: 'prediction_resolved',
  profile_viewed: 'profile_viewed',
  personal_best_viewed: 'personal_best_viewed',
  benefit_viewed: 'benefit_viewed',
  claim_started: 'claim_started',
  otp_requested: 'otp_requested',
  otp_verified: 'otp_verified',
  benefit_issued: 'benefit_issued',
  qr_generated: 'qr_generated',
  redemption_lookup: 'redemption_lookup',
  redemption_validated: 'redemption_validated',
  redemption_failed: 'redemption_failed',
  matchweek_returned: 'matchweek_returned',
  notification_sent: 'notification_sent',
  notification_received: 'notification_received',
  notification_opened: 'notification_opened',
  share_clicked: 'share_clicked',
  support_requested: 'support_requested',
  consent_given: 'consent_given',
  consent_withdrawn: 'consent_withdrawn',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Events the SERVER is the single authoritative source for (prompt §42). */
export const SERVER_AUTHORITATIVE: ReadonlySet<EventName> = new Set<EventName>([
  EVENTS.prediction_submitted,
  EVENTS.prediction_updated,
  EVENTS.prediction_resolved,
  EVENTS.otp_requested,
  EVENTS.otp_verified,
  EVENTS.benefit_issued,
  EVENTS.redemption_validated,
  EVENTS.redemption_failed,
  EVENTS.consent_given,
  EVENTS.consent_withdrawn,
]);

/** Keys that must NEVER appear in event properties. */
const FORBIDDEN_PROP_KEYS = ['phone', 'phone_e164', 'otp', 'code', 'code_hash', 'token'];

export interface AnalyticsEvent {
  name: EventName;
  anonymousSessionId?: string | null;
  supporterId?: string | null;
  fixtureId?: string | null;
  campaignId?: string | null;
  sponsorId?: string | null;
  merchantId?: string | null;
  merchantLocationId?: string | null;
  source?: string | null;
  props?: Record<string, unknown>;
}

/** Strip any accidentally-included sensitive keys before persistence. */
export function sanitizeProps(props: Record<string, unknown> = {}): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_PROP_KEYS.includes(k.toLowerCase())) continue;
    clean[k] = v;
  }
  return clean;
}
