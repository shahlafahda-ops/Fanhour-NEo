import crypto from 'node:crypto';
import { db } from '../db.js';

/* ── Identifiers ────────────────────────────────────────────────── */

export const uid = (prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

/** Session/claim tokens must be unguessable — 32 bytes of CSPRNG. */
export const secureToken = () => crypto.randomBytes(32).toString('base64url');

/**
 * Short code the merchant types when the QR camera fails.
 * Crockford-style alphabet: no I/L/O/U, so staff cannot confuse 0/O or 1/I.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function shortCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/* ── Secrets ────────────────────────────────────────────────────── */

const PEPPER = process.env.FH_PHONE_PEPPER || 'dev-only-pepper-do-not-use-in-production';

/** Phone numbers are never stored raw — only an HMAC, per the B4 data-minimization rule. */
export const hashPhone = (e164) =>
  crypto.createHmac('sha256', PEPPER).update(e164).digest('hex');

export const hashSecret = (v) =>
  crypto.createHmac('sha256', PEPPER).update(String(v)).digest('hex');

/** Timing-safe compare so OTP verification cannot be brute-forced by timing. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* ── Time ───────────────────────────────────────────────────────── */

/** Server clock is authoritative for every challenge and expiry decision (B4). */
export const now = () => new Date();
export const iso = (d = new Date()) => d.toISOString().replace('T', ' ').slice(0, 19);
export const isPast = (sqlTs) => new Date(`${sqlTs.replace(' ', 'T')}Z`) < new Date();

/* ── Event taxonomy (B5) ────────────────────────────────────────── */

export const CORE_EVENTS = new Set([
  'landing_view', 'challenge_start', 'answer_submit', 'challenge_complete',
  'result_view', 'offer_view', 'claim_intent', 'verification_start',
  'otp_verified', 'claim_issued', 'validation_attempt', 'redemption_complete',
  'return_participation',
]);

const insertEvent = db.prepare(`
  INSERT INTO events (name, session_id, fan_id, fixture_id, challenge_id, challenge_version, source, props)
  VALUES (@name, @session_id, @fan_id, @fixture_id, @challenge_id, @challenge_version, @source, @props)
`);

/**
 * Record a frozen-taxonomy event. Props are scrubbed of anything that could
 * carry PII — the spec forbids personal data in analytics logs.
 */
export function track(name, ctx = {}) {
  if (!CORE_EVENTS.has(name) && !name.startsWith('diag_')) {
    throw new Error(`Event "${name}" is not in the frozen B5 taxonomy`);
  }
  const { props, ...rest } = ctx;
  insertEvent.run({
    name,
    session_id: rest.session_id ?? null,
    fan_id: rest.fan_id ?? null,
    fixture_id: rest.fixture_id ?? null,
    challenge_id: rest.challenge_id ?? null,
    challenge_version: rest.challenge_version ?? null,
    source: rest.source ?? null,
    props: props ? JSON.stringify(scrub(props)) : null,
  });
}

const FORBIDDEN_PROP_KEYS = /phone|mobile|msisdn|otp|name|address|email|token|pin/i;
function scrub(props) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_PROP_KEYS.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/* ── Audit log ──────────────────────────────────────────────────── */

const insertAudit = db.prepare(`
  INSERT INTO audit_log (actor_type, actor_id, action, subject_type, subject_id, reason, detail)
  VALUES (@actor_type, @actor_id, @action, @subject_type, @subject_id, @reason, @detail)
`);

/** Immutable record. Every manual override must pass a reason (B4). */
export function audit(entry) {
  insertAudit.run({
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    action: entry.action,
    subject_type: entry.subjectType ?? null,
    subject_id: entry.subjectId ?? null,
    reason: entry.reason ?? null,
    detail: entry.detail ? JSON.stringify(entry.detail) : null,
  });
}

/* ── Idempotency (B4) ───────────────────────────────────────────── */

const getIdem = db.prepare('SELECT response FROM idempotency WHERE key = ? AND scope = ?');
const putIdem = db.prepare('INSERT OR IGNORE INTO idempotency (key, scope, response) VALUES (?, ?, ?)');

/**
 * Run `fn` at most once for a given key. A retried network request replays the
 * stored response instead of issuing or redeeming a second time.
 */
export function idempotent(key, scope, fn) {
  if (key) {
    const hit = getIdem.get(key, scope);
    if (hit) return { replayed: true, ...JSON.parse(hit.response) };
  }
  const result = fn();
  if (key) putIdem.run(key, scope, JSON.stringify(result));
  return { replayed: false, ...result };
}

/* ── Saudi mobile validation ────────────────────────────────────── */

/** Accepts 05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX; normalizes to E.164. */
export function normalizeSaudiMobile(input) {
  const digits = String(input || '').replace(/[^\d+]/g, '');
  let m = digits.replace(/^\+?966/, '').replace(/^0/, '');
  if (!/^5\d{8}$/.test(m)) return null;
  return `+966${m}`;
}

/** 18+ gate. Birth-year granularity is deliberate: asking for a full DOB
 *  would collect more personal data than the pilot needs. */
export function isAdultByBirthYear(birthYear, ref = new Date()) {
  const y = Number(birthYear);
  if (!Number.isInteger(y)) return false;
  return ref.getUTCFullYear() - y >= 18;
}

export const LOCALITIES = ['al_rass', 'qassim_other', 'ksa_other', 'outside_ksa'];
export const QASSIM_RELEVANT = new Set(['al_rass', 'qassim_other']);
