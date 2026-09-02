/**
 * Matchweek reminder service — pure domain logic (A1).
 *
 * MRAF (Matchweek Returning Activated Fan) is the North Star metric, but the
 * product has no mechanism to cause a fan to return. This module holds the
 * causal-experiment machinery — randomised holdout assignment, cadence
 * timing, quiet-hours deferral, and the per-fixture send cap — as pure,
 * unit-tested functions. All I/O (DB reads/writes, the actual send) lives in
 * the caller; nothing here talks to a database or a network.
 */

export type ReminderChannel = 'unifonic_sms' | 'whatsapp';
export type HoldoutArm = 'treatment' | 'holdout';
export type CadenceSlot = 't_minus_48h' | 't_minus_2h' | 'resolution';

export const CADENCE_SLOTS: readonly CadenceSlot[] = ['t_minus_48h', 't_minus_2h', 'resolution'];

/**
 * 20% holdout / 80% treatment. This is the experimental design that lets the
 * pilot causally attribute MRAF to reminders — it must never be configurable
 * to zero, so it is a constant, not a flag value.
 */
export const HOLDOUT_PCT = 0.2;

/** Hard cap: at most 3 sends per identity per fixture (one per cadence slot). */
export const MAX_SENDS_PER_FIXTURE = 3;

/** Quiet hours in Asia/Riyadh (fixed UTC+3, no DST) — defer sends, never drop them. */
export const QUIET_HOURS_RIYADH = { startHour: 22, endHour: 8 } as const;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const RIYADH_OFFSET_MS = 3 * MS_PER_HOUR;

/**
 * Assign a consenting identity to `holdout` (20%) or `treatment` (80%).
 * `rand` must come from a uniform [0, 1) source (e.g. `Math.random()`) and is
 * injected so this stays pure and testable. The assignment is made ONCE, at
 * consent time, and persisted — never recomputed.
 */
export function assignHoldoutArm(rand: number): HoldoutArm {
  if (!(rand >= 0) || !(rand < 1)) {
    throw new Error('assignHoldoutArm: rand must be in [0, 1)');
  }
  return rand < HOLDOUT_PCT ? 'holdout' : 'treatment';
}

/** The hour of day (0–23) in Asia/Riyadh for a given instant. */
export function riyadhHour(date: Date): number {
  const riyadhMs = date.getTime() + RIYADH_OFFSET_MS;
  return Math.floor(riyadhMs / MS_PER_HOUR) % 24;
}

/** True during 22:00–08:00 Asia/Riyadh. */
export function isQuietHours(date: Date): boolean {
  const h = riyadhHour(date);
  return h >= QUIET_HOURS_RIYADH.startHour || h < QUIET_HOURS_RIYADH.endHour;
}

/**
 * If `when` falls in quiet hours, push it to the next 08:00 Riyadh; otherwise
 * return it unchanged. Sends are deferred, never dropped.
 */
export function deferIfQuietHours(when: Date): Date {
  if (!isQuietHours(when)) return when;
  const riyadhMs = when.getTime() + RIYADH_OFFSET_MS;
  const dayStartRiyadhMs = Math.floor(riyadhMs / MS_PER_DAY) * MS_PER_DAY;
  const hourOfDay = Math.floor((riyadhMs - dayStartRiyadhMs) / MS_PER_HOUR);
  // 22:00–23:59 -> next Riyadh calendar day's 08:00; 00:00–07:59 -> same day's 08:00.
  const targetDayStart = hourOfDay >= 22 ? dayStartRiyadhMs + MS_PER_DAY : dayStartRiyadhMs;
  const targetRiyadhMs = targetDayStart + QUIET_HOURS_RIYADH.endHour * MS_PER_HOUR;
  return new Date(targetRiyadhMs - RIYADH_OFFSET_MS);
}

export interface FixtureCadenceTimes {
  kickoffAt: Date;
  /** When the fixture was resolved; null while still unresolved. */
  resolvedAt: Date | null;
}

/** The natural (pre-quiet-hours) time a cadence slot is due. */
export function cadenceSlotTime(times: FixtureCadenceTimes, slot: CadenceSlot): Date | null {
  if (slot === 't_minus_48h') return new Date(times.kickoffAt.getTime() - 48 * MS_PER_HOUR);
  if (slot === 't_minus_2h') return new Date(times.kickoffAt.getTime() - 2 * MS_PER_HOUR);
  return times.resolvedAt; // 'resolution' — due exactly when resolved, not before.
}

export interface CadenceDueInput {
  scheduledAt: Date | null;
  now: Date;
  /** A notification_log row already exists for this (subscription, fixture, slot). */
  alreadyLogged: boolean;
  /** Sends already recorded (any outcome='sent') for this identity+fixture. */
  sendsSoFarForFixture: number;
}

/**
 * Whether a cadence slot should fire right now, accounting for the hard cap
 * and de-duplication. Quiet-hours deferral is handled separately by the
 * caller via `deferIfQuietHours` on `scheduledAt` before calling this.
 */
export function isCadenceSlotDue(input: CadenceDueInput): boolean {
  if (input.alreadyLogged) return false;
  if (input.sendsSoFarForFixture >= MAX_SENDS_PER_FIXTURE) return false;
  if (!input.scheduledAt) return false;
  return input.now.getTime() >= input.scheduledAt.getTime();
}

/** A reminder template's shape: a stable key/version pair plus its required parameters. */
export interface ReminderTemplate {
  key: string;
  version: string;
  /** Parameter names the template requires. No free text is ever sent. */
  params: readonly string[];
}

/** One template per cadence slot. Bump `version` whenever the Arabic copy changes. */
export const REMINDER_TEMPLATES: Record<CadenceSlot, ReminderTemplate> = {
  t_minus_48h: { key: 'reminder_t_minus_48h', version: 'v1', params: ['opponentAr', 'kickoffLabel'] },
  t_minus_2h: { key: 'reminder_t_minus_2h', version: 'v1', params: ['opponentAr'] },
  resolution: { key: 'reminder_resolution', version: 'v1', params: ['opponentAr'] },
};

/** Validate that every parameter a template requires is present as a non-empty string. */
export function validateTemplateParams(
  template: ReminderTemplate,
  params: Readonly<Record<string, string>>,
): true | { missing: string[] } {
  const missing = template.params.filter((p) => !params[p]);
  return missing.length === 0 ? true : { missing };
}

/**
 * The experiment readout: MRAF for the treatment arm vs the holdout arm.
 * This is the whole point of the randomised holdout — without it, MRAF only
 * shows correlation, never causation.
 */
export interface ArmMrafSample {
  arm: HoldoutArm;
  isMraf: boolean;
}

export interface ArmMrafSummary {
  n: number;
  mrafCount: number;
  /** Rounded to one decimal place; null with zero samples. */
  mrafRatePct: number | null;
  sampleTooSmall: boolean;
}

/** Below this per-arm sample size, the readout is not trustworthy yet. */
export const MIN_SAMPLE_PER_ARM = 30;

export function summarizeMrafByArm(
  samples: readonly ArmMrafSample[],
): Record<HoldoutArm, ArmMrafSummary> {
  const summarize = (arm: HoldoutArm): ArmMrafSummary => {
    const inArm = samples.filter((s) => s.arm === arm);
    const n = inArm.length;
    const mrafCount = inArm.filter((s) => s.isMraf).length;
    return {
      n,
      mrafCount,
      mrafRatePct: n > 0 ? Math.round((mrafCount / n) * 1000) / 10 : null,
      sampleTooSmall: n < MIN_SAMPLE_PER_ARM,
    };
  };
  return { treatment: summarize('treatment'), holdout: summarize('holdout') };
}
