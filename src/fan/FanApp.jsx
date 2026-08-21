import { useEffect, useState, useCallback } from 'react';
import { TopBar, Spinner, Notice, Button } from '../lib/ui.jsx';
import { fanApi, setSessionId, getSessionId, rememberClaim, ApiError } from '../lib/api.js';
import Landing from './Landing.jsx';
import Challenge from './Challenge.jsx';
import Result from './Result.jsx';
import Offer from './Offer.jsx';
import ClaimGate from './ClaimGate.jsx';
import Otp from './Otp.jsx';
import Claim from './Claim.jsx';
import History from './History.jsx';

/*
 * Fan flow orchestrator — the B1 frozen journey, in order:
 *
 *   landing -> challenge -> result -> offer -> claim gate -> OTP -> claim -> history
 *
 * The first three steps require no identity at all. Nothing before `gate`
 * collects or transmits a single personal field.
 */
const STEP = {
  LOADING: 'loading',
  LANDING: 'landing',
  CHALLENGE: 'challenge',
  RESULT: 'result',
  OFFER: 'offer',
  GATE: 'gate',
  OTP: 'otp',
  CLAIM: 'claim',
  HISTORY: 'history',
};

export default function FanApp() {
  const [step, setStep] = useState(STEP.LOADING);
  const [live, setLive] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [result, setResult] = useState(null);
  const [offer, setOffer] = useState(null);
  const [intent, setIntent] = useState(null);
  const [verification, setVerification] = useState(null);
  const [claim, setClaim] = useState(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [history, setHistory] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [busy, setBusy] = useState(false);

  const source = new URLSearchParams(window.location.search).get('src') || undefined;

  /* Resume an in-flight session on reload so a refresh never costs the result. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fanApi.live(source);
        if (!alive) return;
        setLive(data);

        if (getSessionId()) {
          try {
            const r = await fanApi.result();
            if (alive) { setResult(r.result); setStep(STEP.RESULT); return; }
          } catch { /* no result yet — fall through to landing */ }
        }
        setStep(STEP.LANDING);
      } catch (e) {
        if (alive) setFatal(e instanceof ApiError ? e.message : 'تعذّر الاتصال بالخدمة.');
      }
    })();
    return () => { alive = false; };
  }, [source]);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const data = await fanApi.start(source);
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setStep(STEP.CHALLENGE);
    } catch (e) {
      setFatal(e instanceof ApiError ? e.message : 'تعذّر بدء التحدي.');
    } finally {
      setBusy(false);
    }
  }, [source]);

  const onComplete = useCallback((r) => {
    setResult(r);
    setStep(STEP.RESULT);
  }, []);

  const toOffer = useCallback(async () => {
    setBusy(true);
    try {
      const data = await fanApi.offer();
      setOffer(data);
      setStep(STEP.OFFER);
    } catch {
      await toHistory();
    } finally {
      setBusy(false);
    }
  }, []);

  const toGate = useCallback(async () => {
    setBusy(true);
    try {
      const data = await fanApi.claimIntent();
      setIntent(data);
      setStep(STEP.GATE);
    } catch (e) {
      setFatal(e instanceof ApiError ? e.message : 'تعذّر بدء طلب المزية.');
    } finally {
      setBusy(false);
    }
  }, []);

  const toHistory = useCallback(async () => {
    try {
      setHistory(await fanApi.history());
    } catch {
      setHistory({ verified: false, history: [] });
    }
    setStep(STEP.HISTORY);
  }, []);

  const onIssued = useCallback((issued, { alreadyClaimed: dupe }) => {
    setClaim(issued);
    setAlreadyClaimed(!!dupe);
    rememberClaim(issued.id);
    setStep(STEP.CLAIM);
  }, []);

  const restart = useCallback(() => {
    setSessionId(null);
    setResult(null); setOffer(null); setIntent(null);
    setVerification(null); setClaim(null); setQuestions([]);
    setStep(STEP.LANDING);
  }, []);

  const subtitle = live?.open ? live.challenge.fixture.matchweek : null;

  return (
    <div className="app">
      <div className="shell">
        <TopBar subtitle={subtitle} />

        {fatal && (
          <div className="screen stack">
            <Notice tone="err">{fatal}</Notice>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              أعد المحاولة
            </Button>
          </div>
        )}

        {!fatal && step === STEP.LOADING && <div className="screen"><Spinner /></div>}

        {!fatal && step === STEP.LANDING && live && (
          <Landing data={live} onStart={start} starting={busy} />
        )}

        {!fatal && step === STEP.CHALLENGE && (
          <Challenge questions={questions} onComplete={onComplete} />
        )}

        {!fatal && step === STEP.RESULT && result && (
          <Result result={result} onContinue={toOffer} />
        )}

        {!fatal && step === STEP.OFFER && offer && (
          <Offer
            offer={offer.offer}
            availability={offer.availability}
            independenceNote={offer.independence_note_ar}
            onClaim={toGate}
            onSkip={toHistory}
            busy={busy}
          />
        )}

        {!fatal && step === STEP.GATE && intent && (
          <ClaimGate
            intent={intent}
            onSent={(v) => { setVerification(v); setStep(STEP.OTP); }}
            onBack={() => setStep(STEP.OFFER)}
          />
        )}

        {!fatal && step === STEP.OTP && verification && (
          <Otp
            verification={verification}
            offerId={intent?.offerId}
            onIssued={onIssued}
            onBack={() => setStep(STEP.GATE)}
          />
        )}

        {!fatal && step === STEP.CLAIM && claim && (
          <Claim claim={claim} alreadyClaimed={alreadyClaimed} onDone={toHistory} />
        )}

        {!fatal && step === STEP.HISTORY && history && (
          <History data={history} onReplay={restart} />
        )}
      </div>
    </div>
  );
}
