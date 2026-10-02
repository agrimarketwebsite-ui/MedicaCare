// frontend/src/shared/api.js
// Phase 1 — Shared plumbing: fetch wrapper + session/token architecture.
// (docs/INTEGRATION_ROADMAP.md Phase 1 · docs/FRONTEND_SECURITY_AUDIT.md)
//
// TOKEN STORAGE DECISION:
//   - Access token: MEMORY LANG (module variable sa baba) — HINDI localStorage,
//     dahil XSS-stealable ang localStorage. Nawawala sa page refresh; okay lang
//     dahil may silent refresh (httpOnly cookie).
//   - Refresh token: httpOnly cookie na sine-set ng backend sa
//     POST /api/auth/refresh (path scope /api/auth/refresh, SameSite=Lax,
//     Secure sa prod). Ang frontend ay nagpapadala lang ng
//     `credentials: 'include'` — hindi nito kailanman hinahawakan ang value.
//   - Panuntunan: WALANG token (access man o refresh) ang napupunta sa
//     localStorage — profile cache lang ang pwedeng ma-persist (store.jsx).
//
// Envelope contract (backend/shared/utils/apiResponse.js):
//   success → { success: true, data, meta? }
//   failure → { success: false, message, details? } (+ HTTP status)
// Ang api() ay nag-u-unwrap ng `data`; ang error ay ApiError {status, message, code, details}.

const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:3000/api'
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status; 0 = network error (walang response)
    this.code = code; // backend error code (hal. BAD_REQUEST, SESSION_EXPIRED)
    this.details = details; // safe field-level details mula sa backend
  }
}

// ---------------------------------------------------------------------------
// Token holder — MEMORY ONLY. Hindi ito nade-deriva sa labas maliban sa
// getAccessToken() (pang-debug); ang pag-set ay via login/refresh flows.
// ---------------------------------------------------------------------------
let accessToken = null;
let unauthorizedHandler = null;
let notifyHandler = null;

export const setAccessToken = (token) => { accessToken = token || null; };
export const getAccessToken = () => accessToken;
export const clearAccessToken = () => { accessToken = null; };

/** I-rehistro ang handler na tatawagin kapag tuluyang nag-expire ang session (logout). */
export const onUnauthorized = (fn) => { unauthorizedHandler = fn; };
/** I-rehistro ang toast notifier (wina-wire ng StoreProvider → useStore().pushToast). */
export const setNotify = (fn) => { notifyHandler = fn; };

const notify = (toast) => {
  try { notifyHandler?.(toast); } catch { /* notifier ay best-effort */ }
};

async function parseJson(res) {
  try { return await res.json(); } catch { return null; }
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// ---------------------------------------------------------------------------
// Silent refresh — single-flight: kapag sabay-sabay ang maraming 401, iisa
// lang ang POST /api/auth/refresh na lumalabas (API4 — hindi nag-spam).
// ---------------------------------------------------------------------------
let refreshPromise = null;

/**
 * Tahimik na kumuha ng bagong access token gamit ang httpOnly refresh cookie.
 * @returns {Promise<object>} ang `data` ng refresh response:
 *   { accessToken, profile?, role? } — ang profile/role shape ay Phase 2 contract.
 */
export async function silentRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // ipadala ang httpOnly refresh cookie
      });
      const body = await parseJson(res);
      if (!res.ok || !body || body.success !== true) {
        throw new ApiError(res.status, body?.message || 'Hindi na-refresh ang session', body?.code || 'REFRESH_FAILED');
      }
      const token = body.data?.accessToken;
      if (!token) {
        throw new ApiError(500, 'Maling refresh response mula sa server', 'BAD_REFRESH_RESPONSE');
      }
      setAccessToken(token);
      return body.data;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/**
 * Best-effort na session restore sa app boot (Phase 1 plumbing; ang profile
 * fill ay Phase 2). Kapag walang cookie o expired na, null lang — hindi error.
 */
export async function bootstrapSession() {
  try {
    return await silentRefresh();
  } catch {
    return null;
  }
}

function networkFailure(quiet) {
  if (!quiet) {
    notify({
      kind: 'error',
      title: 'Network error',
      message: 'Hindi makakonekta sa server. Pakitingnan ang connection at subukang muli.',
    });
  }
  throw new ApiError(0, 'Network error — hindi makakonekta sa API server', 'NETWORK_ERROR');
}

/**
 * Raw request: fetch + 401 → tahimik na refresh → ISANG retry.
 * @returns {Promise<{ res: Response, payload: object|null }>}
 * @throws {ApiError} kapag network error o tuluyang expired ang session.
 */
async function requestRaw(path, { method = 'GET', body, headers = {}, auth = true, retry = true, quiet = false } = {}) {
  const doFetch = () => fetch(buildUrl(path), {
    method,
    credentials: 'include', // laging ipadala ang cookies (refresh cookie path)
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let res;
  try {
    res = await doFetch();
  } catch {
    networkFailure(quiet);
  }

  // 401 → tahimik na refresh → isang retry. Kapag nabigo pa rin → logout.
  // Ang logout ay PARA LANG sa tunay na expired/invalid session (401 mula sa
  // refresh). Ang 429 (rate limit) o network error ay HINDI logout-worthy —
  // dati ay naglo-logout din sa mga ito, kaya ang page reloads sa gitna ng
  // rate-limited window ay nagiging spurious logout.
  if (res.status === 401 && auth && retry) {
    try {
      await silentRefresh();
    } catch (err) {
      clearAccessToken();
      if (err instanceof ApiError && err.status === 401) {
        try { unauthorizedHandler?.(); } catch { /* logout handler ay best-effort */ }
        throw new ApiError(401, 'Nag-expire ang session — pakilog-in muli', 'SESSION_EXPIRED');
      }
      throw err instanceof ApiError
        ? err
        : new ApiError(0, 'Hindi na-refresh ang session. Pakisubukang muli.', 'REFRESH_FAILED');
    }
    return requestRaw(path, { method, body, headers, auth, retry: false, quiet });
  }

  const payload = res.status === 204 ? null : await parseJson(res);
  return { res, payload };
}

function toApiError(res, payload) {
  return new ApiError(
    res.status,
    payload?.message || `Nag-fail ang request (HTTP ${res.status})`,
    payload?.code || 'REQUEST_FAILED',
    payload?.details,
  );
}

/**
 * Pangunahing fetch wrapper.
 * @param {string} path hal. '/health' o '/patients/me'
 * @param {object} opts { method, body, headers, auth=true, retry=true }
 * @returns {Promise<any>} ang `data` ng envelope (unwrapped)
 * @throws {ApiError} { status, message, code, details }
 */
export async function api(path, opts = {}) {
  const { res, payload } = await requestRaw(path, opts);
  if (res.status === 204) return null;
  if (!res.ok || !payload || payload.success !== true) throw toApiError(res, payload);
  return payload.data;
}

/**
 * Tulad ng api() pero TAHIMIK kapag nag-fail (walang toast, nagbabalik ng null).
 * Para sa best-effort public data hydration — hindi dapat mag-error ang landing
 * page kapag offline o hindi pa naka-deploy ang API.
 * @returns {Promise<any|null>} ang `data` ng envelope, o null kapag failure
 */
export async function apiOptional(path, opts = {}) {
  try {
    return await api(path, { ...opts, quiet: true });
  } catch {
    return null;
  }
}

/**
 * Kapag kailangan pati ang `meta` (hal. pagination), gamitin ito sa halip na api().
 * @returns {Promise<{ data: any, meta: any }>}
 */
export async function apiWithMeta(path, opts = {}) {
  const { res, payload } = await requestRaw(path, opts);
  if (res.status === 204) return { data: null, meta: undefined };
  if (!res.ok || !payload || payload.success !== true) throw toApiError(res, payload);
  return { data: payload.data, meta: payload.meta };
}

// ---------------------------------------------------------------------------
// Phase 4 — Patient Portal Core endpoints. Lahat ay dumadaan sa api()
// (Bearer + silent refresh), kaya authFetch na rin ang mga ito. Ang envelope
// ay { success, data }; bawat helper ay nag-u-unwrap ng data key nito.
// ---------------------------------------------------------------------------

/** GET /api/patients/me → patient profile ([ENC] fields ay decrypted na). */
export const getProfile = () => api('/patients/me').then((d) => d.patient);

/** PUT /api/patients/me → updated patient profile. */
export const updateProfile = (body) =>
  api('/patients/me', { method: 'PUT', body }).then((d) => d.patient);

/** GET /api/patients/me/family → family members (proxy booking). */
export const listFamily = () => api('/patients/me/family').then((d) => d.family || []);

/** POST /api/patients/me/family → bagong family member (201). */
export const createFamily = (body) =>
  api('/patients/me/family', { method: 'POST', body }).then((d) => d.member);

/** PUT /api/patients/me/family/:id → updated family member. */
export const updateFamily = (id, body) =>
  api(`/patients/me/family/${encodeURIComponent(id)}`, { method: 'PUT', body }).then((d) => d.member);

/** DELETE /api/patients/me/family/:id → 204. */
export const deleteFamily = (id) =>
  api(`/patients/me/family/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** GET /api/appointments/slots?doctor_id&date&duration → slot grid. */
export const getSlots = (doctorId, date, duration = 30) =>
  api(
    `/appointments/slots?doctor_id=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}&duration=${encodeURIComponent(duration)}`,
  ).then((d) => d.slots || []);

/** POST /api/appointments → 201 { appointment }; 409 kapag taken ang slot. */
export const bookAppointment = (body) =>
  api('/appointments', { method: 'POST', body }).then((d) => d.appointment);

/** GET /api/appointments?status= → appointment list ng patient. */
export const getAppointments = (status) =>
  api(`/appointments${status ? `?status=${encodeURIComponent(status)}` : ''}`).then(
    (d) => d.appointments || [],
  );

/** GET /api/appointments/:id → appointment + doctor + status_history. */
export const getAppointment = (id) =>
  api(`/appointments/${encodeURIComponent(id)}`).then((d) => d.appointment);

/** POST /api/appointments/:id/reschedule → 200 { appointment }. */
export const rescheduleAppointment = (id, body) =>
  api(`/appointments/${encodeURIComponent(id)}/reschedule`, { method: 'POST', body }).then(
    (d) => d.appointment,
  );

/** POST /api/appointments/:id/cancel → 200 { appointment }. */
export const cancelAppointment = (id) =>
  api(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).then((d) => d.appointment);

/** POST /api/ratings → 201 { rating }; 409 kapag rated na o hindi completed. */
export const submitRating = (body) =>
  api('/ratings', { method: 'POST', body }).then((d) => d.rating);

// ---------------------------------------------------------------------------
// Doctor portal (Phase 5) — lahat ay requireRole('doctor') sa backend; ang
// BOLA scoping (sariling schedule/pasyente lang) ay via resolveDoctorId.
// ---------------------------------------------------------------------------

/** GET /api/doctors/me/profile → sariling doctor profile (+ rating). */
export const getDoctorProfile = () => api('/doctors/me/profile').then((d) => d.doctor);

/** GET /api/doctors/me/availability → sariling weekly availability. */
export const getDoctorAvailability = () => api('/doctors/me/availability').then((d) => d.availability || []);

/** POST /api/doctors/me/availability → 201 { entry }; 409 kapag duplicate. */
export const createDoctorAvailability = (body) =>
  api('/doctors/me/availability', { method: 'POST', body }).then((d) => d.entry);

/** PUT /api/doctors/me/availability/:id → 200 { entry }. */
export const updateDoctorAvailability = (id, body) =>
  api(`/doctors/me/availability/${encodeURIComponent(id)}`, { method: 'PUT', body }).then((d) => d.entry);

/** DELETE /api/doctors/me/availability/:id → 204. */
export const deleteDoctorAvailability = (id) =>
  api(`/doctors/me/availability/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** GET /api/doctor/appointments/today → { date, appointments }. */
export const getDoctorToday = () => api('/doctor/appointments/today');

/** GET /api/doctor/appointments/patients → { patients } (sariling pasyente lang). */
export const getDoctorPatients = () => api('/doctor/appointments/patients').then((d) => d.patients || []);

/** GET /api/doctor/appointments/week?start= → { week_start, week_end, appointments }. */
export const getDoctorWeek = (start) =>
  api(`/doctor/appointments/week${start ? `?start=${encodeURIComponent(start)}` : ''}`);

/** GET /api/doctor/appointments/:id → { appointment } (BOLA: sariling appointment lang). */
export const getDoctorAppointment = (id) =>
  api(`/doctor/appointments/${encodeURIComponent(id)}`).then((d) => d.appointment);

/** POST /api/doctor/appointments/:id/complete → { appointment, medical_record }. */
export const completeVisit = (id, body) =>
  api(`/doctor/appointments/${encodeURIComponent(id)}/complete`, { method: 'POST', body });

/** POST /api/doctor/appointments/:id/no-show → { appointment }. */
export const markNoShow = (id) =>
  api(`/doctor/appointments/${encodeURIComponent(id)}/no-show`, { method: 'POST' }).then((d) => d.appointment);

/** GET /api/records/medical?patient_id= → medical records ng pasyente. */
export const getMedicalRecords = (patientId) =>
  api(`/records/medical?patient_id=${encodeURIComponent(patientId)}`).then((d) => d.records || []);

/** POST /api/records/medical → 201 { record }. */
export const createMedicalRecord = (body) =>
  api('/records/medical', { method: 'POST', body }).then((d) => d.record);

/** PUT /api/records/medical/:id → 200 { record } (amend — sariling record lang). */
export const updateMedicalRecord = (id, body) =>
  api(`/records/medical/${encodeURIComponent(id)}`, { method: 'PUT', body }).then((d) => d.record);

/** GET /api/records/lab?patient_id= → lab results ng pasyente. */
export const getLabResults = (patientId) =>
  api(`/records/lab?patient_id=${encodeURIComponent(patientId)}`).then((d) => d.lab_results || []);

/** POST /api/records/lab → 201 { lab_result }. */
export const createLabResult = (body) =>
  api('/records/lab', { method: 'POST', body }).then((d) => d.lab_result);

/** GET /api/records/medications?patient_id= → medications ng pasyente. */
export const getMedications = (patientId) =>
  api(`/records/medications?patient_id=${encodeURIComponent(patientId)}`).then((d) => d.medications || []);

/** POST /api/records/medications → 201 { medication }. */
export const createMedication = (body) =>
  api('/records/medications', { method: 'POST', body }).then((d) => d.medication);

/** GET /api/ratings/doctor → { ratings, avg_rating, rating_count }. */
export const getDoctorFeedback = () => api('/ratings/doctor');

export { API_BASE_URL };
export default {
  api, apiOptional, apiWithMeta, silentRefresh, bootstrapSession,
  setAccessToken, getAccessToken, clearAccessToken,
  onUnauthorized, setNotify, ApiError, API_BASE_URL,
  getProfile, updateProfile, listFamily, createFamily, updateFamily, deleteFamily,
  getSlots, bookAppointment, getAppointments, getAppointment,
  rescheduleAppointment, cancelAppointment, submitRating,
  getDoctorProfile, getDoctorAvailability, createDoctorAvailability,
  updateDoctorAvailability, deleteDoctorAvailability,
  getDoctorToday, getDoctorWeek, getDoctorAppointment, getDoctorPatients, completeVisit, markNoShow,
  getMedicalRecords, createMedicalRecord, updateMedicalRecord,
  getLabResults, createLabResult, getMedications, createMedication,
  getDoctorFeedback,
};


