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
  | 'matchweek_status';

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
  notification_timing: { enabled: false },
  cohort_status: { enabled: false },
  matchweek_status: { enabled: false },
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
