import { useEffect, useState } from 'react';
import { Button, Notice } from '../lib/ui.jsx';
import { fanApi } from '../lib/api.js';

/*
 * Result.
 *
 * Personal result, accuracy and concise positive feedback are primary. Public
 * comparison is secondary and collapsed by default (section 9 / B11). A wrong
 * answer is explained, never shamed.
 */
export default function Result({ result, onContinue }) {
  const [status, setStatus] = useState(null);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (!showStatus || status) return;
    fanApi.status().then(setStatus).catch(() => setStatus({ unavailable: true }));
  }, [showStatus, status]);

  const pct = Math.round(result.accuracy * 100);

  return (
    <div className="screen stack">
      <div className="stack-s">
        <span className="eyebrow">نتيجتك</span>
        <h1>
          <span className="num">{result.score}</span> من{' '}
          <span className="num">{result.total}</span>
        </h1>
        <p className="lede">{result.feedback_ar}</p>
        <p className="muted">
          نسبة الإجابات الصحيحة: <span className="num">{pct}%</span>
        </p>
      </div>

      {/* Answer review — concise, positive, and useful for the next fixture. */}
      <div className="stack-s">
        <h2>مراجعة الإجابات</h2>
        {result.review.map((r, i) => (
          <div key={r.questionId} className="card stack-s">
            <h3>
              <span className="num">{i + 1}.</span> {r.text_ar}
            </h3>

            <div
              className={`choice choice--static ${r.wasCorrect ? 'choice--correct' : 'choice--chosen-wrong'}`}
              aria-disabled="true"
            >
              <span className="choice__mark" aria-hidden="true">{r.wasCorrect ? '✓' : '✕'}</span>
              <span>
                {/* The label carries the meaning; colour only reinforces it. */}
                <strong>{r.wasCorrect ? 'إجابتك صحيحة' : 'إجابتك'}:</strong>{' '}
                {r.chosen?.text_ar || '—'}
              </span>
            </div>

            {!r.wasCorrect && (
              <div className="choice choice--static choice--correct" aria-disabled="true">
                <span className="choice__mark" aria-hidden="true">✓</span>
                <span><strong>الإجابة الصحيحة:</strong> {r.correct?.text_ar}</span>
              </div>
            )}

            <p className="muted">{r.explanation_ar}</p>
          </div>
        ))}
      </div>

      <Button onClick={onContinue}>تابع</Button>

      {/* Secondary, optional, never required and never prize-linked. */}
      <div className="card card--quiet stack-s">
        <button
          type="button"
          className="btn btn--ghost"
          aria-expanded={showStatus}
          onClick={() => setShowStatus((v) => !v)}
        >
          {showStatus ? 'إخفاء ترتيب الجولة' : 'اعرض ترتيب هذه الجولة (اختياري)'}
        </button>

        {showStatus && status && !status.unavailable && (
          <div className="stack-s">
            {status.yourBand && (
              <Notice tone="ok" icon="★">{status.yourBand.label_ar}</Notice>
            )}
            <div>
              {status.top.map((row) => (
                <div className="rank" key={row.rank}>
                  <span className="rank__pos num">{row.rank}</span>
                  <span className="rank__name">{row.alias_ar}</span>
                  <span className="rank__score num">{row.score}</span>
                </div>
              ))}
            </div>
            <p className="muted">
              عدد المشاركين في هذه الجولة: <span className="num">{status.participants}</span>
            </p>
            <p className="muted">{status.note_ar}</p>
          </div>
        )}
      </div>
    </div>
  );
}
