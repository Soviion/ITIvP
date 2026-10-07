import { DOCTORS, SEED_APPOINTMENTS, STATUSES, STORAGE_KEYS } from '../constants';
import { loadFromStorage } from './storage';

const STATUS_VALUES = STATUSES.map((status) => status.value);

export const getDoctor = (id) => DOCTORS.find((doctor) => doctor.id === Number(id));

export const getStatusLabel = (value) => STATUSES.find((status) => status.value === value)?.label ?? value;

// '2026-10-07' -> '07.10.2026' (без создания Date, чтобы не зависеть от часового пояса)
export function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

export function todayISO() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const createEmptyDraft = () => ({
  patientName: '',
  doctorId: '',
  date: todayISO(),
  time: '',
  reason: '',
  status: 'scheduled',
});

export const nextId = (items) => items.reduce((max, item) => Math.max(max, item.id), 0) + 1;

// Проверка структуры записи: защита от повреждённых или устаревших данных в localStorage
export function isValidAppointment(value) {
  return Boolean(value)
    && typeof value === 'object'
    && Number.isInteger(value.id)
    && typeof value.patientName === 'string'
    && typeof value.reason === 'string'
    && DOCTORS.some((doctor) => doctor.id === value.doctorId)
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && /^\d{2}:\d{2}$/.test(value.time)
    && STATUS_VALUES.includes(value.status);
}

// Загрузка записей: из localStorage или (если данных нет) начальные данные
export function loadAppointments() {
  const stored = loadFromStorage(STORAGE_KEYS.items, null);
  if (!Array.isArray(stored)) {
    return { items: SEED_APPOINTMENTS, fromStorage: false };
  }
  return { items: stored.filter(isValidAppointment), fromStorage: true };
}

// Проверка формы; возвращает объект { поле: текст ошибки }
export function validateDraft(draft, items, editingId) {
  const errors = {};
  const patientName = draft.patientName.trim();

  if (!patientName) errors.patientName = 'Укажите ФИО пациента';
  else if (patientName.length < 3) errors.patientName = 'ФИО должно содержать не менее 3 символов';
  if (!draft.doctorId) errors.doctorId = 'Выберите врача';
  if (!draft.date) errors.date = 'Укажите дату приёма';
  if (!draft.time) errors.time = 'Укажите время приёма';

  // Как и на сервере: врач не может быть записан дважды на одно время (отменённые записи не считаются)
  if (!errors.doctorId && !errors.date && !errors.time && draft.status !== 'cancelled') {
    const busy = items.some((item) => item.id !== editingId
      && item.doctorId === Number(draft.doctorId)
      && item.date === draft.date
      && item.time === draft.time
      && item.status !== 'cancelled');
    if (busy) errors.time = 'Врач уже занят на это время';
  }
  return errors;
}

// Сортировка: по дате и времени, по пациенту или по врачу
export function compareAppointments(sort) {
  const direction = sort.dir === 'desc' ? -1 : 1;
  const key = {
    datetime: (item) => `${item.date} ${item.time}`,
    patient: (item) => item.patientName.toLowerCase(),
    doctor: (item) => getDoctor(item.doctorId)?.name ?? '',
  }[sort.by] ?? ((item) => `${item.date} ${item.time}`);

  return (a, b) => key(a).localeCompare(key(b), 'ru') * direction || a.id - b.id;
}

export function matchesQuery(item, query) {
  if (!query) return true;
  const doctor = getDoctor(item.doctorId);
  const haystack = `${item.patientName} ${item.reason} ${doctor?.name ?? ''} ${doctor?.specialty ?? ''}`.toLowerCase();
  return haystack.includes(query);
}

export function calculateStats(items) {
  const stats = { total: items.length };
  STATUS_VALUES.forEach((value) => { stats[value] = 0; });
  items.forEach((item) => { stats[item.status] += 1; });
  return stats;
}
