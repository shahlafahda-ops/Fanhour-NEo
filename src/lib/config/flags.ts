import { DEFAULT_PROGRESSION_CONFIG } from '@/lib/domain/progression';

/**
 * Feature flags (prompt §49). Defaults live here so the app is safe even if the
 * feature_flag table is empty; ops can override rows in the DB. No public
 * experiment UI is exposed.
 */

export type FlagKey =
  | 'community_feedback'
  | 'optional_depth'
  | 'registration_timing'
  | 'rich_profile'
  | 'personal_best'
  | 'benefit_enabled'
  | 'benefit_framing'
  | 'benefit_reveal_timing'
  | 'notification_timing'
  | 'cohort_status'
  | 'matchweek_status'
  | 'commentary_reactions'
  | 'post_match_poll'
  | 'progression_config';

export interface FlagState {
  enabled: boolean;
  value?: unknown;
}

/** Safe defaults. Note global leaderboard and daily streak simply do not exist. */
export const FLAG_DEFAULTS: Record<FlagKey, FlagState> = {
  community_feedback: { enabled: true },
  optional_depth: { enabled: true },
  registration_timing: { enabled: true, value: { mode: 'deferred' } },
  rich_profile: { enabled: true },
  personal_best: { enabled: true },
  benefit_enabled: { enabled: true },
  benefit_framing: { enabled: true, value: { style: 'additive' } },
  benefit_reveal_timing: { enabled: true, value: { default: 'post_result' } },
  // A1 — the one Part A feature that ships ON: the reminder service is the
  // pilot's highest-priority causal experiment, and the notify provider
  // factory hard-fails on `mock` in production exactly like OTP, so this
  // flag alone can never cause a real send without real credentials.
  notification_timing: { enabled: true },
  cohort_status: { enabled: false },
  matchweek_status: { enabled: false },
  // Football-commentary microcopy. ON for Pilot 1: it is expression only and
  // never affects XP, rank or sponsor-benefit eligibility.
  commentary_reactions: { enabled: true },
  // Deferred to P1 — no poll surface is built in Pilot 1 P0.
  post_match_poll: { enabled: false },
  // XP values + rank thresholds, tunable from the DB without a deploy. The
  // rank names/keys/order themselves are never tunable — see
  // `parseProgressionConfig` in src/lib/domain/progression.ts.
  progression_config: { enabled: true, value: DEFAULT_PROGRESSION_CONFIG },
};

export function resolveFlags(rows: { key: string; enabled: boolean; value: unknown }[]): Record<
  FlagKey,
  FlagState
> {
  const resolved = { ...FLAG_DEFAULTS };
  for (const row of rows) {
    if (row.key in resolved) {
      resolved[row.key as FlagKey] = { enabled: row.enabled, value: row.value ?? undefined };
    }
  }
  return resolved;
}
