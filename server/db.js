import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = process.env.FH_DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'fanhour.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/*
 * Schema implements Appendix B3 (state machines) and B4 (technical controls).
 * Every uniqueness constraint here is load-bearing: the spec requires the
 * database — not application code — to be the thing that makes duplicate
 * verified results and duplicate claims impossible.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS fixtures (
  id            TEXT PRIMARY KEY,
  pilot_index   TEXT NOT NULL UNIQUE,      -- F1..F10
  opponent_ar   TEXT NOT NULL,
  opponent_en   TEXT NOT NULL,
  home_away     TEXT NOT NULL CHECK (home_away IN ('home','away')),
  kickoff_at    TEXT NOT NULL,             -- ISO8601 UTC
  matchweek     TEXT NOT NULL,
  opponent_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Challenge: DRAFT -> SCHEDULED -> OPEN -> LOCKED -> SETTLED -> ARCHIVED
CREATE TABLE IF NOT EXISTS challenges (
  id            TEXT PRIMARY KEY,
  fixture_id    TEXT NOT NULL REFERENCES fixtures(id),
  version       INTEGER NOT NULL DEFAULT 1,
  state         TEXT NOT NULL DEFAULT 'DRAFT'
                CHECK (state IN ('DRAFT','SCHEDULED','OPEN','LOCKED','SETTLED','ARCHIVED')),
  title_ar      TEXT NOT NULL,
  opens_at      TEXT NOT NULL,
  closes_at     TEXT NOT NULL,
  locked_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (fixture_id, version)
);

CREATE TABLE IF NOT EXISTS questions (
  id             TEXT PRIMARY KEY,
  challenge_id   TEXT NOT NULL REFERENCES challenges(id),
  position       INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  difficulty     TEXT NOT NULL CHECK (difficulty IN ('accessible','moderate','differentiating')),
  text_ar        TEXT NOT NULL,
  explanation_ar TEXT NOT NULL,
  UNIQUE (challenge_id, position)
);

CREATE TABLE IF NOT EXISTS options (
  id           TEXT PRIMARY KEY,
  question_id  TEXT NOT NULL REFERENCES questions(id),
  position     INTEGER NOT NULL,
  text_ar      TEXT NOT NULL,
  is_correct   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, position)
);

-- Anonymous session: CREATED -> STARTED -> COMPLETED -> RESULT_VIEWED -> CLAIM_INTENT | EXIT
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,          -- cryptographically random, no PII
  challenge_id  TEXT NOT NULL REFERENCES challenges(id),
  state         TEXT NOT NULL DEFAULT 'CREATED'
                CHECK (state IN ('CREATED','STARTED','COMPLETED','RESULT_VIEWED','CLAIM_INTENT','EXIT')),
  source        TEXT,                      -- utm / campaign source code
  answer_order  TEXT NOT NULL,             -- JSON: server-fixed question + option order
  fan_id        TEXT REFERENCES fans(id),  -- bound only after OTP_VERIFIED
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS answers (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  question_id  TEXT NOT NULL REFERENCES questions(id),
  option_id    TEXT NOT NULL REFERENCES options(id),
  answered_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, question_id)         -- no answer mutation
);

CREATE TABLE IF NOT EXISTS results (
  session_id       TEXT PRIMARY KEY REFERENCES sessions(id),
  challenge_id     TEXT NOT NULL REFERENCES challenges(id),
  challenge_version INTEGER NOT NULL,
  score            INTEGER NOT NULL,
  accuracy         REAL NOT NULL,
  status_points    INTEGER NOT NULL DEFAULT 0,   -- recognition only, non-redeemable
  completed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pseudonymous verified fan. Created only at successful OTP.
CREATE TABLE IF NOT EXISTS fans (
  id                TEXT PRIMARY KEY,
  phone_hash        TEXT NOT NULL UNIQUE,   -- HMAC, never the raw number
  phone_last2       TEXT NOT NULL,          -- for support disambiguation only
  alias_ar          TEXT NOT NULL,          -- privacy-safe display alias
  birth_year        INTEGER NOT NULL,
  locality          TEXT NOT NULL
                    CHECK (locality IN ('al_rass','qassim_other','ksa_other','outside_ksa')),
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  marketing_consent_at TEXT,
  terms_version     TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Only the FIRST verified result per fan/fixture enters official cohorts (B4).
CREATE TABLE IF NOT EXISTS verified_results (
  fan_id       TEXT NOT NULL REFERENCES fans(id),
  fixture_id   TEXT NOT NULL REFERENCES fixtures(id),
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  score        INTEGER NOT NULL,
  accuracy     REAL NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (fan_id, fixture_id)
);

-- Verification: NOT_STARTED -> ELIGIBILITY_OK -> OTP_SENT -> OTP_VERIFIED | FAILED | RATE_LIMITED
CREATE TABLE IF NOT EXISTS verifications (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  offer_id      TEXT NOT NULL REFERENCES offers(id),
  state         TEXT NOT NULL DEFAULT 'NOT_STARTED'
                CHECK (state IN ('NOT_STARTED','ELIGIBILITY_OK','OTP_SENT','OTP_VERIFIED','FAILED','RATE_LIMITED')),
  phone_hash    TEXT,
  otp_hash      TEXT,
  otp_sent_at   TEXT,
  otp_expires_at TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  resends       INTEGER NOT NULL DEFAULT 0,
  birth_year    INTEGER,
  locality      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sponsors (
  id         TEXT PRIMARY KEY,
  name_ar    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  tier       TEXT NOT NULL CHECK (tier IN ('foundation','activation','category_exclusive')),
  paid       INTEGER NOT NULL DEFAULT 1,   -- commercial integrity rule: paid vs complimentary
  arrangement TEXT NOT NULL DEFAULT 'paid'
              CHECK (arrangement IN ('paid','launch_credit','subsidised','complimentary_test','merchant_only')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outlets (
  id         TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES sponsors(id),
  name_ar    TEXT NOT NULL,
  area       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS offers (
  id             TEXT PRIMARY KEY,
  sponsor_id     TEXT NOT NULL REFERENCES sponsors(id),
  challenge_id   TEXT NOT NULL REFERENCES challenges(id),
  title_ar       TEXT NOT NULL,
  benefit_ar     TEXT NOT NULL,
  terms_ar       TEXT NOT NULL,             -- material terms, shown before claim
  excluded_ar    TEXT,
  valid_hours_ar TEXT NOT NULL,
  cap_total      INTEGER NOT NULL,
  cap_daily      INTEGER,
  claimed_count  INTEGER NOT NULL DEFAULT 0,
  expires_at     TEXT NOT NULL,
  escalation_contact TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1,
  CHECK (claimed_count >= 0 AND claimed_count <= cap_total)
);

CREATE TABLE IF NOT EXISTS offer_outlets (
  offer_id  TEXT NOT NULL REFERENCES offers(id),
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  PRIMARY KEY (offer_id, outlet_id)
);

CREATE TABLE IF NOT EXISTS staff (
  id         TEXT PRIMARY KEY,
  outlet_id  TEXT NOT NULL REFERENCES outlets(id),
  name       TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Claim: AVAILABLE -> VERIFICATION_PENDING -> ISSUED -> REDEEMED | EXPIRED | VOID | MANUAL_REVIEW
CREATE TABLE IF NOT EXISTS claims (
  id           TEXT PRIMARY KEY,
  fan_id       TEXT NOT NULL REFERENCES fans(id),
  offer_id     TEXT NOT NULL REFERENCES offers(id),
  session_id   TEXT NOT NULL REFERENCES sessions(id),
  token        TEXT NOT NULL UNIQUE,       -- single-use server token
  short_code   TEXT NOT NULL UNIQUE,       -- fallback, typed by merchant staff
  state        TEXT NOT NULL DEFAULT 'ISSUED'
               CHECK (state IN ('ISSUED','REDEEMED','EXPIRED','VOID','MANUAL_REVIEW')),
  issued_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  UNIQUE (fan_id, offer_id)                -- one claim per verified fan/offer
);

CREATE TABLE IF NOT EXISTS redemptions (
  id           TEXT PRIMARY KEY,
  claim_id     TEXT NOT NULL UNIQUE REFERENCES claims(id),  -- idempotent redeem
  offer_id     TEXT NOT NULL REFERENCES offers(id),
  sponsor_id   TEXT NOT NULL REFERENCES sponsors(id),
  outlet_id    TEXT NOT NULL REFERENCES outlets(id),
  staff_id     TEXT NOT NULL REFERENCES staff(id),
  issued_at    TEXT NOT NULL,
  redeemed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  status       TEXT NOT NULL CHECK (status IN ('CONFIRMED','REJECTED','MANUAL_REVIEW')),
  manual_override_reason TEXT
);

CREATE TABLE IF NOT EXISTS validation_attempts (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  claim_id    TEXT REFERENCES claims(id),
  outlet_id   TEXT NOT NULL REFERENCES outlets(id),
  staff_id    TEXT NOT NULL REFERENCES staff(id),
  result      TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- B5 frozen event taxonomy. Never carries PII.
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  session_id   TEXT,
  fan_id       TEXT,
  fixture_id   TEXT,
  challenge_id TEXT,
  challenge_version INTEGER,
  source       TEXT,
  props        TEXT,
  occurred_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type  TEXT NOT NULL,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  subject_type TEXT,
  subject_id  TEXT,
  reason      TEXT,
  detail      TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS idempotency (
  key         TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  response    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_name     ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_session  ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_claims_fan      ON claims(fan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_chal   ON sessions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_vr_fixture      ON verified_results(fixture_id);
`);

export default db;
