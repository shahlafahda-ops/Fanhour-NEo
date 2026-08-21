import { db } from '../db.js';
import { uid, secureToken, track, iso, isPast } from './core.js';

/*
 * Challenge state machine (B3):
 *   DRAFT -> SCHEDULED -> OPEN -> LOCKED -> SETTLED -> ARCHIVED
 *
 * The server clock and the stored challenge version are authoritative.
 * Answers cannot be mutated after lock, and the client-side score is never
 * trusted — the score is always recomputed here from the stored answer rows.
 */

const OPEN_STATES = new Set(['OPEN']);

export function getChallengeById(id) {
  return db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);
}

/** The challenge for the next/current eligible fixture. */
export function getLiveChallenge() {
  return db.prepare(`
    SELECT c.*, f.pilot_index, f.opponent_ar, f.opponent_en, f.home_away, f.kickoff_at, f.matchweek
      FROM challenges c
      JOIN fixtures f ON f.id = c.fixture_id
     WHERE c.state = 'OPEN'
     ORDER BY c.opens_at ASC
     LIMIT 1
  `).get();
}

export function getNextFixture() {
  return db.prepare(`
    SELECT * FROM fixtures WHERE kickoff_at > datetime('now') ORDER BY kickoff_at ASC LIMIT 1
  `).get();
}

/**
 * Effective state, accounting for the wall clock. A challenge that is nominally
 * OPEN but past its close time is treated as LOCKED even before the sweeper runs,
 * so a request arriving at the boundary cannot slip through.
 */
export function effectiveState(challenge) {
  if (challenge.state === 'OPEN' && isPast(challenge.closes_at)) return 'LOCKED';
  if (challenge.state === 'SCHEDULED' && !isPast(challenge.opens_at)) return 'SCHEDULED';
  return challenge.state;
}

/** Promote SCHEDULED -> OPEN and OPEN -> LOCKED based on the server clock. */
export function sweepChallengeStates() {
  const opened = db.prepare(`
    UPDATE challenges SET state = 'OPEN'
     WHERE state = 'SCHEDULED' AND opens_at <= datetime('now')
  `).run();
  const locked = db.prepare(`
    UPDATE challenges SET state = 'LOCKED', locked_at = datetime('now')
     WHERE state = 'OPEN' AND closes_at <= datetime('now')
  `).run();
  return { opened: opened.changes, locked: locked.changes };
}

/* ── Sessions ───────────────────────────────────────────────────── */

/**
 * Create an anonymous session. No PII is required or collected here — this is
 * the top of the funnel and the spec requires it stay frictionless.
 *
 * The presentation order of questions and options is fixed server-side at
 * creation time and stored, so a client cannot reshuffle to probe for answers.
 */
export function createSession(challengeId, source) {
  const questions = db.prepare(`
    SELECT id FROM questions WHERE challenge_id = ? ORDER BY position
  `).all(challengeId);

  const order = questions.map((q) => ({
    questionId: q.id,
    optionIds: shuffle(
      db.prepare('SELECT id FROM options WHERE question_id = ?').all(q.id).map((o) => o.id),
    ),
  }));

  const id = `ses_${secureToken().slice(0, 32)}`;
  db.prepare(`
    INSERT INTO sessions (id, challenge_id, state, source, answer_order)
    VALUES (?, ?, 'CREATED', ?, ?)
  `).run(id, challengeId, source || null, JSON.stringify(order));

  return { id, order };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const getSession = (id) => db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);

export function setSessionState(id, state) {
  db.prepare('UPDATE sessions SET state = ? WHERE id = ?').run(state, id);
}

/**
 * Public question payload. `is_correct` is deliberately excluded — the correct
 * answer key never leaves the server while the challenge is open.
 */
export function getQuestionsForSession(session) {
  const order = JSON.parse(session.answer_order);
  return order.map(({ questionId, optionIds }, idx) => {
    const q = db.prepare('SELECT id, position, difficulty, text_ar FROM questions WHERE id = ?').get(questionId);
    const opts = optionIds.map((oid) =>
      db.prepare('SELECT id, text_ar FROM options WHERE id = ?').get(oid),
    );
    return { ...q, position: idx + 1, options: opts };
  });
}

/* ── Answering ──────────────────────────────────────────────────── */

export function submitAnswer(session, questionId, optionId) {
  const challenge = getChallengeById(session.challenge_id);
  if (effectiveState(challenge) !== 'OPEN') {
    return { ok: false, reason: 'CHALLENGE_LOCKED' };
  }
  if (db.prepare('SELECT 1 FROM results WHERE session_id = ?').get(session.id)) {
    return { ok: false, reason: 'ALREADY_COMPLETE' };
  }

  const option = db.prepare('SELECT * FROM options WHERE id = ? AND question_id = ?')
    .get(optionId, questionId);
  if (!option) return { ok: false, reason: 'INVALID_OPTION' };

  const order = JSON.parse(session.answer_order);
  if (!order.some((o) => o.questionId === questionId)) {
    return { ok: false, reason: 'QUESTION_NOT_IN_SESSION' };
  }

  try {
    db.prepare(`
      INSERT INTO answers (id, session_id, question_id, option_id)
      VALUES (?, ?, ?, ?)
    `).run(uid('ans'), session.id, questionId, optionId);
  } catch (e) {
    // UNIQUE(session_id, question_id) — answers are immutable once given.
    if (String(e.message).includes('UNIQUE')) return { ok: false, reason: 'ALREADY_ANSWERED' };
    throw e;
  }

  if (session.state === 'CREATED') setSessionState(session.id, 'STARTED');

  track('answer_submit', {
    session_id: session.id,
    challenge_id: challenge.id,
    challenge_version: challenge.version,
    fixture_id: challenge.fixture_id,
    source: session.source,
    props: { question_position: order.findIndex((o) => o.questionId === questionId) + 1 },
  });

  const answered = db.prepare('SELECT COUNT(*) c FROM answers WHERE session_id = ?').get(session.id).c;
  return { ok: true, answered, total: order.length };
}

/* ── Scoring ────────────────────────────────────────────────────── */

/**
 * Recompute the score from stored rows and persist the result.
 *
 * Status points are recognition only: non-redeemable, no cash value, no wallet
 * balance (B11). They exist purely to drive the optional matchweek status view.
 */
export function completeChallenge(session) {
  const existing = db.prepare('SELECT * FROM results WHERE session_id = ?').get(session.id);
  if (existing) return { ok: true, result: buildResult(session, existing), replayed: true };

  const challenge = getChallengeById(session.challenge_id);
  const order = JSON.parse(session.answer_order);
  const answers = db.prepare('SELECT * FROM answers WHERE session_id = ?').all(session.id);

  if (answers.length < order.length) {
    return { ok: false, reason: 'INCOMPLETE', answered: answers.length, total: order.length };
  }

  let score = 0;
  for (const a of answers) {
    const opt = db.prepare('SELECT is_correct FROM options WHERE id = ?').get(a.option_id);
    if (opt?.is_correct) score += 1;
  }
  const accuracy = score / order.length;
  const statusPoints = score * 10;

  db.prepare(`
    INSERT INTO results (session_id, challenge_id, challenge_version, score, accuracy, status_points)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(session.id, challenge.id, challenge.version, score, accuracy, statusPoints);

  setSessionState(session.id, 'COMPLETED');

  track('challenge_complete', {
    session_id: session.id,
    challenge_id: challenge.id,
    challenge_version: challenge.version,
    fixture_id: challenge.fixture_id,
    source: session.source,
    props: { score, accuracy },
  });

  const row = db.prepare('SELECT * FROM results WHERE session_id = ?').get(session.id);
  return { ok: true, result: buildResult(session, row) };
}

/** Positive-feedback copy. The spec forbids shaming a wrong answer. */
function feedbackFor(score, total) {
  if (score === total) return 'ممتاز! إجابات كاملة. معرفتك بالحزم في المستوى.';
  if (score >= total - 1) return 'أداء قوي! قريب جدًا من العلامة الكاملة.';
  if (score >= 1) return 'بداية جيدة — أصبت في جزء من التحدي. الجولة القادمة فرصة جديدة.';
  return 'شكرًا لمشاركتك! إليك الإجابات الصحيحة حتى تكون جاهزًا للجولة القادمة.';
}

function buildResult(session, row) {
  const questions = db.prepare(`
    SELECT id, position, text_ar, explanation_ar FROM questions WHERE challenge_id = ? ORDER BY position
  `).all(row.challenge_id);

  const review = questions.map((q) => {
    const given = db.prepare('SELECT option_id FROM answers WHERE session_id = ? AND question_id = ?')
      .get(session.id, q.id);
    const correct = db.prepare('SELECT id, text_ar FROM options WHERE question_id = ? AND is_correct = 1').get(q.id);
    const chosen = given
      ? db.prepare('SELECT id, text_ar FROM options WHERE id = ?').get(given.option_id)
      : null;
    return {
      questionId: q.id,
      text_ar: q.text_ar,
      explanation_ar: q.explanation_ar,
      correct,
      chosen,
      wasCorrect: !!(chosen && correct && chosen.id === correct.id),
    };
  });

  return {
    score: row.score,
    total: review.length,
    accuracy: row.accuracy,
    statusPoints: row.status_points,
    feedback_ar: feedbackFor(row.score, review.length),
    review,
    completedAt: row.completed_at,
  };
}

export { buildResult };

/* ── Matchweek status (secondary, optional, never prize-linked) ──── */

/**
 * Fixture-bounded status board.
 *
 * Per B11 and section 9: privacy-safe aliases only, no persistent global ladder,
 * no prize linkage, and the fan's own low rank is never foregrounded — callers
 * receive a positive band label rather than a raw position.
 */
export function getMatchweekStatus(challengeId, sessionId) {
  const top = db.prepare(`
    SELECT COALESCE(f.alias_ar, 'مشجّع الحزم') AS alias_ar, r.score, r.status_points
      FROM results r
      JOIN sessions s ON s.id = r.session_id
      LEFT JOIN fans f ON f.id = s.fan_id
     WHERE r.challenge_id = ?
     ORDER BY r.status_points DESC, r.completed_at ASC
     LIMIT 10
  `).all(challengeId);

  const totals = db.prepare('SELECT COUNT(*) c FROM results WHERE challenge_id = ?').get(challengeId);
  const mine = sessionId
    ? db.prepare('SELECT score, status_points FROM results WHERE session_id = ?').get(sessionId)
    : null;

  let band = null;
  if (mine && totals.c > 0) {
    const better = db.prepare(`
      SELECT COUNT(*) c FROM results WHERE challenge_id = ? AND status_points > ?
    `).get(challengeId, mine.status_points).c;
    const percentile = 1 - better / totals.c;
    band = bandFor(percentile);
  }

  return {
    participants: totals.c,
    top: top.map((t, i) => ({ rank: i + 1, alias_ar: t.alias_ar, score: t.score })),
    yourBand: band,
    note_ar: 'هذه لوحة تقدير للمتعة فقط، ولا علاقة لها بأي جائزة أو مزية.',
  };
}

/** Positive bands only — there is no "bottom" label by design. */
function bandFor(percentile) {
  if (percentile >= 0.9) return { key: 'top', label_ar: 'ضمن الأفضل في هذه الجولة' };
  if (percentile >= 0.6) return { key: 'strong', label_ar: 'أداء قوي هذه الجولة' };
  return { key: 'participant', label_ar: 'مشارك في تحدي هذه الجولة' };
}
