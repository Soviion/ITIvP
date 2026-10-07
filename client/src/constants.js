// Ключи localStorage
export const STORAGE_KEYS = {
  items: 'clinic.appointments',
  filter: 'clinic.appointments.filter',
  sort: 'clinic.appointments.sort',
};

export const LOAD_DELAY_MS = 1000; // имитация загрузки с сервера
export const SAVE_DELAY_MS = 500; // debounce автосохранения

export const DOCTORS = [
  { id: 1, name: 'Петрова А.С.', specialty: 'Терапевт' },
  { id: 2, name: 'Кузнецов В.В.', specialty: 'Хирург' },
  { id: 3, name: 'Лебедева И.П.', specialty: 'Кардиолог' },
  { id: 4, name: 'Соколов Д.А.', specialty: 'Невролог' },
  { id: 5, name: 'Мороз Е.Н.', specialty: 'Офтальмолог' },
  { id: 6, name: 'Ковалёв А.И.', specialty: 'Педиатр' },
];

// Те же статусы, что в серверном API (лабораторная работа №2)
export const STATUSES = [
  { value: 'scheduled', label: 'Запланирована' },
  { value: 'completed', label: 'Завершена' },
  { value: 'cancelled', label: 'Отменена' },
  { value: 'no_show', label: 'Не явился' },
];

export const SORT_OPTIONS = [
  { value: 'datetime', label: 'По дате и времени' },
  { value: 'patient', label: 'По пациенту' },
  { value: 'doctor', label: 'По врачу' },
];

export const DEFAULT_FILTER = 'all';
export const DEFAULT_SORT = { by: 'datetime', dir: 'asc' };

// Начальные данные: используются, если в localStorage ещё ничего нет
export const SEED_APPOINTMENTS = [
  { id: 1, patientName: 'Иванов Иван', doctorId: 1, date: '2026-10-07', time: '09:30', reason: 'Плановый осмотр', status: 'scheduled' },
  { id: 2, patientName: 'Сидорова Мария', doctorId: 3, date: '2026-10-07', time: '10:00', reason: 'Боли в области сердца при нагрузке', status: 'scheduled' },
  { id: 3, patientName: 'Смирнов Пётр', doctorId: 1, date: '2026-10-06', time: '14:15', reason: 'Кашель, повышенная температура', status: 'completed' },
  { id: 4, patientName: 'Козлова Анна', doctorId: 5, date: '2026-10-06', time: '11:00', reason: 'Снижение остроты зрения', status: 'completed' },
  { id: 5, patientName: 'Волков Артём', doctorId: 6, date: '2026-10-08', time: '12:00', reason: 'Профилактический осмотр ребёнка', status: 'scheduled' },
  { id: 6, patientName: 'Белова Екатерина', doctorId: 1, date: '2026-10-09', time: '09:00', reason: 'Справка', status: 'cancelled' },
];
