import { useState } from 'react';
import { Progress, Notice, Button } from '../lib/ui.jsx';
import { fanApi, ApiError } from '../lib/api.js';

/*
 * The three-question challenge.
 *
 * One primary action per screen. No per-question countdown at Day 0 (B10) —
 * the experience is kept naturally short instead of applying artificial
 * pressure. Answers are final once submitted, matching the server's
 * immutability rule, and the UI says so before the fan commits.
 */
export default function Challenge({ questions, onComplete }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  async function submit() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await fanApi.answer(question.id, selected);
      if (isLast) {
        const { result } = await fanApi.complete();
        onComplete(result);
        return;
      }
      setIndex((i) => i + 1);
      setSelected(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'تعذّر إرسال الإجابة. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen stack">
      <Progress current={index + 1} total={questions.length} />

      <div className="stack-s">
        <span className="eyebrow">السؤال {index + 1}</span>
        <h1>{question.text_ar}</h1>
      </div>

      <div
        className="stack-s"
        role="radiogroup"
        aria-label={question.text_ar}
      >
        {question.options.map((opt, i) => {
          const on = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className="choice"
              role="radio"
              aria-checked={on}
              aria-pressed={on}
              disabled={busy}
              onClick={() => setSelected(opt.id)}
            >
              <span className="choice__mark" aria-hidden="true">
                {on ? '✓' : String.fromCharCode(0x0623 + i)}
              </span>
              <span>{opt.text_ar}</span>
            </button>
          );
        })}
      </div>

      {error && <Notice tone="err">{error}</Notice>}

      <Button onClick={submit} disabled={!selected || busy}>
        {busy ? 'جارٍ الإرسال…' : isLast ? 'أنهِ التحدي' : 'التالي'}
      </Button>

      <p className="muted" style={{ textAlign: 'center' }}>
        لا يمكن تغيير الإجابة بعد إرسالها.
      </p>
    </div>
  );
}
