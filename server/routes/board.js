import express from 'express';
import { db } from '../db.js';
import { QASSIM_RELEVANT } from '../lib/core.js';

const router = express.Router();

/*
 * Live value board.
 *
 * This is NOT the club/sponsor self-serve dashboard the spec forbids. It is a
 * FanHour-operated presentation surface: key-gated, aggregate-only, no login
 * for the club, no per-sponsor drill-down, and nothing here is delivered as a
 * contractual reporting deliverable. Sponsor reporting stays manual (section 16).
 *
 * Its whole job is to answer one question on a projector while the room plays:
 * engagement exists — how does it become value?
 */

router.use((req, res, next) => {
  const key = req.query.k || req.get('x-fh-board-key');
  const expected = process.env.FH_BOARD_KEY || 'dev-board-key';
  if (key !== expected) return res.status(401).json({ error: 'BOARD_KEY_REQUIRED' });
  next();
});

const distinct = (name) => db.prepare(
  `SELECT COUNT(DISTINCT session_id) c FROM events WHERE name = ? AND session_id IS NOT NULL`,
).get(name).c;

const rows = (name) => db.prepare(`SELECT COUNT(*) c FROM events WHERE name = ?`).get(name).c;

router.get('/', (req, res) => {
  /* ── Layer 1: the engagement that already exists ── */
  // landing_view fires before a session exists, so it is counted as raw rows.
  // Every later step has a session and is counted as distinct sessions.
  const landings     = rows('landing_view');
  const starts       = distinct('challenge_start');
  const completions  = distinct('challenge_complete');
  const answers      = db.prepare(`SELECT COUNT(*) c FROM answers`).get().c;
  const resultViews  = distinct('result_view');

  /* ── Layer 2: what that engagement converted into ── */
  const verifiedFans = db.prepare('SELECT COUNT(*) c FROM fans').get().c;
  const claims       = db.prepare('SELECT COUNT(*) c FROM claims').get().c;
  const redemptions  = db.prepare(`SELECT COUNT(*) c FROM redemptions WHERE status = 'CONFIRMED'`).get().c;

  const localityRows = db.prepare('SELECT locality, COUNT(*) c FROM fans GROUP BY locality').all();
  const localLookup = Object.fromEntries(localityRows.map((r) => [r.locality, r.c]));
  const qassimRelevant = localityRows
    .filter((r) => QASSIM_RELEVANT.has(r.locality))
    .reduce((a, r) => a + r.c, 0);

  /* Live ticker. Anonymous by construction — event rows carry no PII. */
  const recent = db.prepare(`
    SELECT name, occurred_at FROM events
     WHERE name IN ('challenge_start','challenge_complete','claim_issued','redemption_complete')
     ORDER BY id DESC LIMIT 12
  `).all();

  const rate = (n, d) => (d > 0 ? Number((n / d).toFixed(3)) : null);

  res.json({
    engagement: {
      landings,
      starts,
      completions,
      answers,
      resultViews,
      completionRate: rate(completions, starts),
    },
    value: {
      verifiedFans,
      qassimRelevant,
      claims,
      redemptions,
      byLocality: {
        al_rass: localLookup.al_rass || 0,
        qassim_other: localLookup.qassim_other || 0,
        ksa_other: localLookup.ksa_other || 0,
        outside_ksa: localLookup.outside_ksa || 0,
      },
      verificationRate: rate(verifiedFans, completions),
      claimToRedemption: rate(redemptions, claims),
    },
    recent,
    at: new Date().toISOString(),
  });
});

export default router;
