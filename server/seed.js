import { db } from './db.js';
import { uid, hashSecret, iso } from './lib/core.js';

/*
 * Pilot seed data.
 *
 * Fixtures come from section 4 of the Execution Pack. Only F1, F4 and F10 have
 * opponents verified against official SAFF pages; the rest are matchweek windows
 * whose opponent/home-away detail the spec explicitly says must be attached from
 * the final official schedule rather than invented. They are seeded with
 * opponent_confirmed = 0 and must be completed before launch.
 *
 * Sponsors/offers here are illustrative pilot configuration, not signed deals.
 */

const FIXTURES = [
  { idx: 'F1',  ar: 'الأهلي',    en: 'Al Ahli',      ha: 'away', date: '2026-09-10', mw: 'MW1',  confirmed: 1 },
  { idx: 'F2',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-09-17', mw: 'MW2',  confirmed: 0 },
  { idx: 'F3',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-10-09', mw: 'MW3',  confirmed: 0 },
  { idx: 'F4',  ar: 'الهلال',    en: 'Al Hilal',     ha: 'away', date: '2026-10-15', mw: 'MW4',  confirmed: 1 },
  { idx: 'F5',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-10-22', mw: 'MW5',  confirmed: 0 },
  { idx: 'F6',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-10-29', mw: 'MW6',  confirmed: 0 },
  { idx: 'F7',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-11-05', mw: 'MW7',  confirmed: 0 },
  { idx: 'F8',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-11-20', mw: 'MW8',  confirmed: 0 },
  { idx: 'F9',  ar: 'يُحدد لاحقًا', en: 'TBC',        ha: 'home', date: '2026-11-26', mw: 'MW9',  confirmed: 0 },
  { idx: 'F10', ar: 'القادسية',  en: 'Al Qadisiyah', ha: 'home', date: '2026-12-03', mw: 'MW10', confirmed: 1 },
];

/*
 * Confidence progression required by B10: one accessible question, one moderate,
 * one differentiating. The objective is competence and return, not elimination.
 */
const QUESTION_SETS = {
  F1: [
    {
      difficulty: 'accessible',
      text_ar: 'ما هو لقب نادي الحزم؟',
      explanation_ar: 'يُعرف نادي الحزم بلقب «الفارس»، وهو من أندية مدينة الرس بمنطقة القصيم.',
      options: [
        { text_ar: 'الفارس', correct: true },
        { text_ar: 'العميد', correct: false },
        { text_ar: 'الزعيم', correct: false },
      ],
    },
    {
      difficulty: 'moderate',
      text_ar: 'في أي مدينة يقع نادي الحزم؟',
      explanation_ar: 'نادي الحزم من مدينة الرس في منطقة القصيم.',
      options: [
        { text_ar: 'الرس', correct: true },
        { text_ar: 'بريدة', correct: false },
        { text_ar: 'عنيزة', correct: false },
      ],
    },
    {
      difficulty: 'differentiating',
      text_ar: 'في أي سنة تأسس نادي الحزم؟',
      explanation_ar: 'تأسس نادي الحزم عام 1957م.',
      options: [
        { text_ar: '1957', correct: true },
        { text_ar: '1965', correct: false },
        { text_ar: '1974', correct: false },
      ],
    },
  ],
};

// A generic set so every seeded fixture has a playable challenge in development.
const GENERIC_SET = (opponentAr) => [
  {
    difficulty: 'accessible',
    text_ar: 'ما هو لون الطقم الأساسي لنادي الحزم؟',
    explanation_ar: 'يلعب الحزم بالطقم الأبيض والأزرق.',
    options: [
      { text_ar: 'الأبيض والأزرق', correct: true },
      { text_ar: 'الأحمر والأسود', correct: false },
      { text_ar: 'الأصفر والأخضر', correct: false },
    ],
  },
  {
    difficulty: 'moderate',
    text_ar: `في أي منطقة يقع ملعب مواجهة ${opponentAr}؟`,
    explanation_ar: 'راجع جدول المباريات الرسمي لتفاصيل الملعب.',
    options: [
      { text_ar: 'القصيم', correct: true },
      { text_ar: 'عسير', correct: false },
      { text_ar: 'تبوك', correct: false },
    ],
  },
  {
    difficulty: 'differentiating',
    text_ar: 'كم عدد جولات دوري روشن السعودي في الموسم؟',
    explanation_ar: 'ينقسم دوري روشن السعودي إلى 34 جولة.',
    options: [
      { text_ar: '34 جولة', correct: true },
      { text_ar: '30 جولة', correct: false },
      { text_ar: '38 جولة', correct: false },
    ],
  },
];

export function seed({ openFixture = 'F1' } = {}) {
  const existing = db.prepare('SELECT COUNT(*) c FROM fixtures').get().c;
  if (existing > 0) return { skipped: true };

  const run = db.transaction(() => {
    for (const f of FIXTURES) {
      const fixtureId = uid('fix');
      db.prepare(`
        INSERT INTO fixtures (id, pilot_index, opponent_ar, opponent_en, home_away, kickoff_at, matchweek, opponent_confirmed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fixtureId, f.idx, f.ar, f.en, f.ha, `${f.date} 17:00:00`, f.mw, f.confirmed);

      const isOpen = f.idx === openFixture;
      const challengeId = uid('chl');

      // The challenge opens ahead of kickoff and locks at kickoff.
      const opens = isOpen ? iso(new Date(Date.now() - 3600_000)) : `${f.date} 09:00:00`;
      const closes = isOpen ? iso(new Date(Date.now() + 7 * 24 * 3600_000)) : `${f.date} 17:00:00`;

      db.prepare(`
        INSERT INTO challenges (id, fixture_id, version, state, title_ar, opens_at, closes_at)
        VALUES (?, ?, 1, ?, ?, ?, ?)
      `).run(
        challengeId, fixtureId, isOpen ? 'OPEN' : 'SCHEDULED',
        `تحدي الحزم — ${f.ar}`, opens, closes,
      );

      const set = QUESTION_SETS[f.idx] || GENERIC_SET(f.ar);
      set.forEach((q, i) => {
        const qid = uid('qst');
        db.prepare(`
          INSERT INTO questions (id, challenge_id, position, difficulty, text_ar, explanation_ar)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(qid, challengeId, i + 1, q.difficulty, q.text_ar, q.explanation_ar);

        q.options.forEach((o, j) => {
          db.prepare(`
            INSERT INTO options (id, question_id, position, text_ar, is_correct)
            VALUES (?, ?, ?, ?, ?)
          `).run(uid('opt'), qid, j + 1, o.text_ar, o.correct ? 1 : 0);
        });
      });

      if (isOpen) seedCommercial(challengeId, f.date);
    }
  });

  run();
  return { skipped: false, fixtures: FIXTURES.length };
}

function seedCommercial(challengeId, fixtureDate) {
  const sponsorId = uid('spn');
  db.prepare(`
    INSERT INTO sponsors (id, name_ar, name_en, tier, paid, arrangement)
    VALUES (?, ?, ?, 'activation', 1, 'paid')
  `).run(sponsorId, 'مطعم الرس الشعبي', 'Al Rass Popular Restaurant');

  const outletId = uid('out');
  db.prepare(`
    INSERT INTO outlets (id, sponsor_id, name_ar, area) VALUES (?, ?, ?, ?)
  `).run(outletId, sponsorId, 'فرع الرس الرئيسي', 'الرس');

  const offerId = uid('ofr');
  db.prepare(`
    INSERT INTO offers (id, sponsor_id, challenge_id, title_ar, benefit_ar, terms_ar, excluded_ar,
                        valid_hours_ar, cap_total, cap_daily, expires_at, escalation_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    offerId, sponsorId, challengeId,
    'مشروب مجاني مع أي وجبة',
    'احصل على مشروب مجاني عند طلب أي وجبة رئيسية.',
    'المزية متاحة لمرة واحدة لكل مشجّع. تُقدَّم عند طلب وجبة رئيسية. صالحة في الفرع المحدد فقط. لا تُستبدل بقيمة نقدية.',
    'لا تشمل المشروبات المعبأة الفاخرة والعصائر الطازجة الكبيرة.',
    'يوميًا من 12 ظهرًا حتى 11 مساءً',
    200, 40,
    `${fixtureDate} 23:59:59`,
    'دعم فان أور — 8001234567',
  );

  db.prepare('INSERT INTO offer_outlets (offer_id, outlet_id) VALUES (?, ?)').run(offerId, outletId);

  // Demo staff account. Production staff are provisioned by ops, never seeded.
  db.prepare(`
    INSERT INTO staff (id, outlet_id, name, pin_hash) VALUES (?, ?, ?, ?)
  `).run('staff_demo', outletId, 'كاشير الفرع', hashSecret('1234'));
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  console.log(seed());
}
