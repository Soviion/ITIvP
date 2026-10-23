import axios from 'axios';
import { fromApiAppointment, toApiAppointment, toApiPatient } from './utils/appointments';
import { apiToIsoDate, isoToApiDate } from './utils/dates';
import { fromApiMe, toApiProfile } from './utils/patient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// Искусственная задержка для демонстрации спиннера и оптимистичного UI (VITE_API_DELAY_MS в .env)
const FAKE_DELAY_MS = Number(import.meta.env.VITE_API_DELAY_MS) || 0;
const TOKEN_KEY = 'clinic.token';

// Повтор запроса при ошибке: всего до 3 попыток, пауза растёт: 1 с, 2 с
export const RETRY = { attempts: 3, baseDelayMs: 1000 };


let memoryToken = null; 

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
    } catch {
      return memoryToken;
    }
  },
  set(token) {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch { /* без localStorage токен живёт до перезагрузки страницы */ }
  },
  clear() {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch { /* ничего не делаем */ }
  },
};

//  Экземпляр axios 
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
});

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new axios.CanceledError());
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(new axios.CanceledError());
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

api.interceptors.request.use(async (config) => {
  if (FAKE_DELAY_MS) await sleep(FAKE_DELAY_MS, config.signal);

  const token = tokenStorage.get();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let retrySeq = 0;
let retrySnapshot = null;
const retryEntries = new Map();
const retryListeners = new Set();

function publishRetry() {
  const entries = [...retryEntries.values()];
  retrySnapshot = entries.length ? entries[entries.length - 1] : null;
  retryListeners.forEach((listener) => listener());
}

export const retryStore = {
  subscribe(listener) {
    retryListeners.add(listener);
    return () => retryListeners.delete(listener);
  },
  getSnapshot: () => retrySnapshot,
};

function clearRetry(config) {
  if (config?.__retryId && retryEntries.delete(config.__retryId)) publishRetry();
}

function shouldRetry(error) {
  if (axios.isCancel(error) || error.config?.retry === false) return false;
  if (!error.response) return true;
  return error.response.status >= 500 || error.response.status === 408;
}

const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

api.interceptors.response.use(
  (response) => {
    clearRetry(response.config);
    return response;
  },
  async (error) => {
    const { config } = error;

    if (config && shouldRetry(error)) {
      const attempt = config.__attempt ?? 1;
      if (attempt < RETRY.attempts) {
        const delayMs = RETRY.baseDelayMs * 2 ** (attempt - 1);
        const id = (config.__retryId ??= ++retrySeq);
        const entry = { id, attempt: attempt + 1, max: RETRY.attempts, delayMs, method: config.method?.toUpperCase(), url: config.url };

        config.__attempt = attempt + 1;
        retryEntries.set(id, { ...entry, phase: 'waiting' });
        publishRetry();

        try {
          await sleep(delayMs, config.signal);
        } catch (cancel) {
          clearRetry(config);
          throw cancel;
        }

        retryEntries.set(id, { ...entry, phase: 'sending' });
        publishRetry();
        return api.request(config); 
      }
    }

    clearRetry(config);

    if (error.response?.status === 401 && config?.headers?.Authorization) {
      tokenStorage.clear();
      unauthorizedListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  },
);


export const isCanceled = (error) => axios.isCancel(error);
export const getStatus = (error) => error?.response?.status ?? null;

export function getErrorMessage(error) {
  if (!error?.response) {
    return error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT'
      ? 'Сервер не ответил вовремя. Проверьте соединение и повторите попытку.'
      : 'Не удалось связаться с сервером. Проверьте, что сервер запущен и есть подключение к сети.';
  }
  const { status, data } = error.response;
  const text = typeof data?.error === 'string' ? data.error : '';
  if (status >= 500) return text ? `${text}. Повторите попытку позже.` : 'Ошибка на стороне сервера. Повторите попытку позже.';
  return text || `Запрос не выполнен (код ${status}).`;
}

export function getFieldErrors(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, { field, message }) => (field && !acc[field] ? { ...acc, [field]: message } : acc), {});
}

export const getDetailMessages = (error) => {
  const details = error?.response?.data?.details;
  return Array.isArray(details) ? details.map((item) => item.message) : [];
};

//  Записи на приём: CRUD 

export const fetchAppointments = (signal) => api
  .get('/appointments', { signal })
  .then(({ data }) => data.map(fromApiAppointment));

export const addAppointment = (draft) => api
  .post('/appointments', toApiAppointment(draft))
  .then(({ data }) => fromApiAppointment(data));

export const updateAppointment = (id, draft) => api
  .put(`/appointments/${id}`, toApiAppointment(draft))
  .then(({ data }) => fromApiAppointment(data));

export const patchAppointment = (id, changes) => api
  .patch(`/appointments/${id}`, changes)
  .then(({ data }) => fromApiAppointment(data));

export const deleteAppointment = (id) => api
  .delete(`/appointments/${id}`)
  .then(({ data }) => data);


export const fetchPatients = (signal) => api.get('/patients', { signal }).then(({ data }) => data);

export const createPatient = (draft) => api.post('/patients', toApiPatient(draft)).then(({ data }) => data);

export const fetchDoctors = (signal) => api.get('/doctors', { signal }).then(({ data }) => data);


export const fetchSlotDays = (doctorId, signal, exclude) => api
  .get('/slots/days', { params: { doctorId, exclude }, signal })
  .then(({ data }) => data.map((day) => ({ date: apiToIsoDate(day.date), free: day.free })));

export const fetchSlots = (doctorId, isoDate, signal, exclude) => api
  .get('/slots', { params: { doctorId, date: isoToApiDate(isoDate), exclude }, signal })
  .then(({ data }) => data.slots);

//  Личный кабинет пациента 

export const fetchMe = (signal) => api.get('/me', { signal }).then(({ data }) => fromApiMe(data));

export const updatePatientProfile = (values) => api
  .patch('/me/patient', toApiProfile(values), { retry: false })
  .then(({ data }) => fromApiMe(data));

// changes: { bloodType?, diseases?, medications? }
export const updateRecord = (changes) => api
  .patch('/me/record', changes, { retry: false })
  .then(({ data }) => fromApiMe(data));

export const fetchMyAppointments = (signal) => api
  .get('/me/appointments', { signal })
  .then(({ data }) => data.map(fromApiAppointment));

export const bookAppointment = ({ doctorId, date, time, reason }) => api
  .post('/me/appointments', { doctorId, date: isoToApiDate(date), time, reason }, { retry: false })
  .then(({ data }) => fromApiAppointment(data));

export const cancelMyAppointment = (id) => api
  .post(`/me/appointments/${id}/cancel`, null, { retry: false })
  .then(({ data }) => fromApiAppointment(data));

export const fetchDoctor = (id, signal) => api.get(`/doctors/${id}`, { signal }).then(({ data }) => data);

// Перенос и/или смена описания собственной записи: changes = { date?, time?, reason? }
export const updateMyAppointment = (id, changes) => api
  .patch(`/me/appointments/${id}`, { ...changes, ...(changes.date ? { date: isoToApiDate(changes.date) } : {}) }, { retry: false })
  .then(({ data }) => fromApiAppointment(data));
