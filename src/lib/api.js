/*
 * API client.
 *
 * The anonymous session id lives in sessionStorage, not a cookie: it is not an
 * identity, it must not survive as a cross-device credential (B11), and keeping
 * it out of cookies avoids it riding along on every request by default.
 */

const SESSION_KEY = 'fh.session';
const CLAIM_KEY = 'fh.claim';

export const getSessionId = () => {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
};
export const setSessionId = (id) => {
  try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
};

/** Local convenience only — the server remains the source of truth for the claim. */
export const rememberClaim = (id) => { try { localStorage.setItem(CLAIM_KEY, id); } catch { /* ignore */ } };
export const recallClaim = () => { try { return localStorage.getItem(CLAIM_KEY); } catch { return null; } };

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message_ar || body?.error || 'حدث خطأ غير متوقع');
    this.status = status;
    this.code = body?.error;
    this.body = body || {};
  }
}

async function request(method, path, { body, headers = {} } = {}) {
  const session = getSessionId();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(session ? { 'x-fh-session': session } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

export const api = {
  get:  (p, o) => request('GET', p, o),
  post: (p, body, o) => request('POST', p, { ...o, body: body ?? {} }),
};

/* ── Fan endpoints ──────────────────────────────────────────────── */

export const fanApi = {
  live:      (src) => api.get(`/challenge/live${src ? `?src=${encodeURIComponent(src)}` : ''}`),
  start:     (source) => api.post('/challenge/start', { source }),
  answer:    (questionId, optionId) => api.post('/challenge/answer', { questionId, optionId }),
  complete:  () => api.post('/challenge/complete'),
  result:    () => api.get('/result'),
  status:    () => api.get('/status'),
  offer:     () => api.get('/offer'),
  claimIntent: () => api.post('/claim/intent'),
  verifyStart: (payload) => api.post('/claim/verify/start', payload),
  verifyConfirm: (payload) => api.post('/claim/verify/confirm', payload),
  claim:     (id) => api.get(`/claim/${id}`),
  history:   () => api.get('/history'),
};

/* ── Merchant endpoints ─────────────────────────────────────────── */

const STAFF_KEY = 'fh.staff';

export const staffToken = {
  get: () => { try { return JSON.parse(localStorage.getItem(STAFF_KEY) || 'null'); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(STAFF_KEY, JSON.stringify(v)) : localStorage.removeItem(STAFF_KEY); } catch { /* ignore */ } },
};

async function merchantRequest(method, path, body) {
  const auth = staffToken.get();
  const res = await fetch(`/api/merchant${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth?.token ? { authorization: `Bearer ${auth.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  if (res.status === 401) staffToken.set(null);
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

export const merchantApi = {
  login:    (staffId, pin) => merchantRequest('POST', '/login', { staffId, pin }),
  logout:   () => merchantRequest('POST', '/logout'),
  validate: (code) => merchantRequest('POST', '/validate', { code }),
  redeem:   (code, manualReason) => merchantRequest('POST', '/redeem', { code, manualReason }),
  activity: () => merchantRequest('GET', '/activity'),
};
