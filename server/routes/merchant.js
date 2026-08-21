import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { uid, track, audit, hashSecret, safeEqual } from '../lib/core.js';
import {
  inspectClaim, confirmRedemption, VALIDATION_RESULTS, staffVelocityAlert,
} from '../lib/claims.js';

const router = express.Router();

/*
 * Merchant validator.
 *
 * RBAC rule from B4: staff accounts are outlet-scoped, revocable, and have no
 * access to fan phone numbers. Nothing this router returns contains fan PII —
 * the merchant sees a claim code, an offer, and a status. That is all they need.
 */

const sessions = new Map();   // token -> { staffId, outletId, issuedAt }
const STAFF_SESSION_TTL = 8 * 3600 * 1000;

function requireStaff(req, res) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const s = sessions.get(token);
  if (!s || Date.now() - s.issuedAt > STAFF_SESSION_TTL) {
    sessions.delete(token);
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return null;
  }
  const staff = db.prepare('SELECT * FROM staff WHERE id = ? AND active = 1').get(s.staffId);
  if (!staff) {
    // Revoked mid-session: drop it immediately.
    sessions.delete(token);
    res.status(401).json({ error: 'STAFF_REVOKED' });
    return null;
  }
  return { ...s, staff };
}

router.post('/login', (req, res) => {
  const { staffId, pin } = req.body || {};
  const staff = db.prepare('SELECT * FROM staff WHERE id = ? AND active = 1').get(staffId);

  // Constant-ish response shape so a wrong id and a wrong PIN look the same.
  if (!staff || !safeEqual(hashSecret(String(pin)), staff.pin_hash)) {
    audit({ actorType: 'staff', actorId: staffId || null, action: 'login_failed' });
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }

  const outlet = db.prepare('SELECT * FROM outlets WHERE id = ?').get(staff.outlet_id);
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { staffId: staff.id, outletId: staff.outlet_id, issuedAt: Date.now() });

  audit({ actorType: 'staff', actorId: staff.id, action: 'login_ok', detail: { outlet_id: outlet.id } });
  res.json({ token, staff: { id: staff.id, name: staff.name }, outlet: { id: outlet.id, name_ar: outlet.name_ar } });
});

router.post('/logout', (req, res) => {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  res.json({ ok: true });
});

/** Look up a code. Read-only: this does not redeem anything. */
router.post('/validate', (req, res) => {
  const ctx = requireStaff(req, res);
  if (!ctx) return;

  const { code } = req.body || {};
  const out = inspectClaim(code, ctx.outletId);

  db.prepare(`
    INSERT INTO validation_attempts (id, code, claim_id, outlet_id, staff_id, result)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid('vat'), String(code || '').slice(0, 32), out.claim?.id || null, ctx.outletId, ctx.staff.id, out.result);

  track('validation_attempt', { props: { result: out.result, outlet_id: ctx.outletId } });

  const labels = {
    VALID:                'صالحة — سلّم المزية للمشجّع',
    EXPIRED:              'منتهية الصلاحية',
    ALREADY_REDEEMED:     'مستخدمة سابقًا',
    WRONG_OFFER_LOCATION: 'هذه المزية لا تخص هذا الفرع',
    MANUAL_REVIEW:        'تحتاج مراجعة يدوية — تواصل مع الدعم',
    NOT_FOUND:            'رمز غير معروف',
  };

  // Response carries no fan identifier of any kind.
  res.json({
    result: out.result,
    label_ar: labels[out.result],
    claim: out.claim && {
      id: out.claim.id,
      shortCode: out.claim.short_code,
      state: out.claim.state,
      expiresAt: out.claim.expires_at,
    },
    offer: out.offer && {
      title_ar: out.offer.title_ar,
      benefit_ar: out.offer.benefit_ar,
      excluded_ar: out.offer.excluded_ar,
      sponsor_name_ar: out.offer.sponsor_name_ar,
    },
    canConfirm: out.result === VALIDATION_RESULTS.VALID,
  });
});

/** Confirm the redemption. Idempotent — a retry returns ALREADY_REDEEMED
 *  rather than creating a second record. */
router.post('/redeem', (req, res) => {
  const ctx = requireStaff(req, res);
  if (!ctx) return;

  const { code, manualReason } = req.body || {};
  const out = inspectClaim(code, ctx.outletId);

  if (out.result !== VALIDATION_RESULTS.VALID) {
    return res.status(409).json({ error: out.result, message_ar: 'لا يمكن إتمام العملية.' });
  }

  const done = confirmRedemption({
    claim: out.claim, outletId: ctx.outletId, staffId: ctx.staff.id, manualReason,
  });

  if (!done.ok) {
    return res.status(409).json({ error: done.reason, message_ar: 'تم استخدام هذه المزية مسبقًا.' });
  }

  track('redemption_complete', { props: { offer_id: out.offer.id, outlet_id: ctx.outletId } });

  const alert = staffVelocityAlert(ctx.staff.id);
  if (alert) {
    audit({
      actorType: 'system', action: 'fraud_review_flag',
      subjectType: 'staff', subjectId: ctx.staff.id,
      reason: '5+ validations from one staff identity within two minutes',
    });
  }

  res.json({ ok: true, redemptionId: done.redemptionId, message_ar: 'تم تأكيد الاستخدام.' });
});

/** Today's activity for this outlet. Aggregate only. */
router.get('/activity', (req, res) => {
  const ctx = requireStaff(req, res);
  if (!ctx) return;

  const rows = db.prepare(`
    SELECT r.redeemed_at, r.status, o.title_ar
      FROM redemptions r JOIN offers o ON o.id = r.offer_id
     WHERE r.outlet_id = ? AND r.redeemed_at > datetime('now', '-1 day')
     ORDER BY r.redeemed_at DESC LIMIT 50
  `).all(ctx.outletId);

  res.json({ outlet: ctx.outletId, redemptions: rows, count: rows.length });
});

export default router;
