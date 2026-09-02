/**
 * Verified Reach Index (VRI) — A4. Sponsor value evidence beyond redemption
 * counts alone. VRI is NOT impressions and NOT guaranteed reach — it is an
 * upper-bound estimate of fans FanHour could plausibly notify right now,
 * built entirely from verified, first-party numbers (never inferred or
 * purchased). Every input must be labelled wherever VRI is shown.
 */
export interface VriInputs {
  /** Total verified registered fans (supporter rows with a phone on file). */
  registeredFans: number;
  /** 0..1 — share of registered fans with a qualified prediction in the last 90 days. */
  activeRate90d: number;
  /** 0..1 — share of registered fans with an active (non-withdrawn) reminder subscription. */
  notificationReachability: number;
}

export interface VriResult {
  /** Rounded to the nearest whole fan. */
  vri: number;
  /** Clamped, echoed-back inputs — what the report must label alongside the number. */
  inputs: VriInputs;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function computeVri(inputs: VriInputs): VriResult {
  const registeredFans = Math.max(0, Math.round(inputs.registeredFans));
  const activeRate90d = clamp01(inputs.activeRate90d);
  const notificationReachability = clamp01(inputs.notificationReachability);
  return {
    vri: Math.round(registeredFans * activeRate90d * notificationReachability),
    inputs: { registeredFans, activeRate90d, notificationReachability },
  };
}
