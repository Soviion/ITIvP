import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_FILTER, DEFAULT_SORT, LOAD_DELAY_MS, SAVE_DELAY_MS, SEED_APPOINTMENTS, STORAGE_KEYS,
} from '../constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { saveToStorage } from '../utils/storage';
import {
  calculateStats, compareAppointments, createEmptyDraft, getDoctor, loadAppointments,
  matchesQuery, nextId, validateDraft,
} from '../utils/appointments';
import AppointmentForm from './AppointmentForm';
import AppointmentItem from './AppointmentItem';
import Filters from './Filters';
import StatsPanel from './StatsPanel';

export default function AppointmentList() {
  // ---------- Состояние (useState) ----------
  const [items, setItems] = useState([]); // массив записей на приём
  const [loading, setLoading] = useState(true); // идёт «загрузка с сервера»
  const [draft, setDraft] = useState(createEmptyDraft); // значения полей формы (ленивая инициализация)
  const [errors, setErrors] = useState({}); // ошибки валидации формы
  const [editingId, setEditingId] = useState(null); // id редактируемой записи или null
  const [query, setQuery] = useState(''); // строка поиска
  const [filter, setFilter] = useLocalStorage(STORAGE_KEYS.filter, DEFAULT_FILTER); // фильтр по статусу
  const [sort, setSort] = useLocalStorage(STORAGE_KEYS.sort, DEFAULT_SORT); // сортировка
  const [saveState, setSaveState] = useState({ status: 'idle', at: null }); // индикатор автосохранения

  // Ссылки (useRef) не вызывают перерисовку: хранят последнюю сохранённую версию и актуальный массив
  const lastSavedRef = useRef(null);
  const itemsRef = useRef(items);

  // ---------- Эффекты (useEffect) ----------

  // 1. Загрузка при монтировании (пустой массив зависимостей — эффект выполняется один раз).
  //    Задержка в 1 секунду имитирует запрос к серверу.
  useEffect(() => {
    const timer = setTimeout(() => {
      const { items: loaded, fromStorage } = loadAppointments();
      if (!fromStorage) saveToStorage(STORAGE_KEYS.items, loaded); // первый запуск: сохраняем начальные данные
      lastSavedRef.current = loaded;
      setItems(loaded);
      setLoading(false);
    }, LOAD_DELAY_MS);

    return () => clearTimeout(timer); // очистка: если компонент удалён раньше, таймер отменяется
  }, []);

  // 2. Сохранение в localStorage при каждом изменении items с debounce 500 мс:
  //    каждое новое изменение отменяет предыдущий таймер, поэтому запись происходит
  //    один раз — через 500 мс после последнего изменения.
  useEffect(() => {
    if (loading || items === lastSavedRef.current) return undefined; // не перезаписываем только что загруженное

    setSaveState((prev) => ({ ...prev, status: 'saving' }));
    const timer = setTimeout(() => {
      saveToStorage(STORAGE_KEYS.items, items);
      lastSavedRef.current = items;
      setSaveState({ status: 'saved', at: new Date() });
    }, SAVE_DELAY_MS);

    return () => clearTimeout(timer); // очистка: новое изменение сбрасывает ожидание
  }, [items, loading]);

  // 3. Если страницу закрыли или перезагрузили раньше, чем сработал debounce, — сохраняем сразу
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (loading) return undefined;
    const flush = () => {
      if (itemsRef.current !== lastSavedRef.current) saveToStorage(STORAGE_KEYS.items, itemsRef.current);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [loading]);

  // 4. Заголовок страницы зависит от количества записей
  useEffect(() => {
    document.title = loading ? 'Загрузка… — записи на приём' : `Записи на приём (${items.length}) — Клиника`;
  }, [items.length, loading]);

  // ---------- Обработчики ----------
  const resetForm = useCallback(() => {
    setDraft(createEmptyDraft());
    setErrors({});
    setEditingId(null);
  }, []);

  // 5. Горячая клавиша: Esc отменяет редактирование и очищает форму
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') resetForm();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetForm]);

  const handleFieldChange = useCallback((name, value) => {
    setDraft((prev) => ({ ...prev, [name]: value })); // обновление на основе предыдущего значения
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name]; // ошибка поля исчезает, как только пользователь его изменил
      if (name === 'doctorId' || name === 'date' || name === 'status') delete next.time; // конфликт времени зависит от этих полей
      return next;
    });
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault(); // отключаем стандартную отправку формы (перезагрузку страницы)

    const problems = validateDraft(draft, items, editingId);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const clean = {
      patientName: draft.patientName.trim(),
      doctorId: Number(draft.doctorId),
      date: draft.date,
      time: draft.time,
      reason: draft.reason.trim(),
      status: draft.status,
    };

    if (editingId === null) {
      setItems((prev) => [...prev, { id: nextId(prev), ...clean }]); // добавление: создаётся новый массив
    } else {
      setItems((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...clean } : item))); // редактирование
    }
    resetForm();
  };

  const handleEdit = useCallback((item) => {
    setEditingId(item.id);
    setDraft({
      patientName: item.patientName,
      doctorId: String(item.doctorId),
      date: item.date,
      time: item.time,
      reason: item.reason,
      status: item.status,
    });
    setErrors({});
  }, []);

  const handleDelete = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setEditingId((current) => (current === id ? null : current));
  }, []);

  const handleStatusChange = useCallback((id, status) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }, []);

  const handleReset = () => {
    if (!window.confirm('Вернуть исходные демонстрационные записи? Текущие записи будут удалены.')) return;
    setItems(SEED_APPOINTMENTS);
    resetForm();
  };

  const clearFilters = () => {
    setQuery('');
    setFilter(DEFAULT_FILTER);
  };

  // ---------- Производные данные (useMemo) ----------
  const stats = useMemo(() => calculateStats(items), [items]);

  // Фильтрация и сортировка пересчитываются только при изменении исходных данных или настроек
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => (filter === 'all' || item.status === filter) && matchesQuery(item, normalizedQuery))
      .sort(compareAppointments(sort));
  }, [items, query, filter, sort]);

  // ---------- Разметка ----------
  const isFiltered = query.trim() !== '' || filter !== 'all';

  return (
    <div className="layout">
      <StatsPanel stats={stats} loading={loading} />

      <div className="columns">
        <section className="card form-card" aria-labelledby="form-title">
          <h2 id="form-title">
            {editingId === null ? 'Новая запись на приём' : `Редактирование записи №${editingId}`}
          </h2>
          <fieldset className="plain" disabled={loading}>
            <AppointmentForm
              draft={draft}
              errors={errors}
              editingId={editingId}
              onFieldChange={handleFieldChange}
              onSubmit={handleSubmit}
              onCancel={resetForm}
            />
          </fieldset>
          <p className="hint">Enter — сохранить запись, Esc — отмена</p>
        </section>

        <section className="card list-card" aria-labelledby="list-title">
          <div className="list-head">
            <h2 id="list-title">Записи на приём</h2>
            {!loading && <span className="list-count">Показано {visibleItems.length} из {items.length}</span>}
          </div>

          <Filters
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            sort={sort}
            onSortChange={setSort}
            stats={stats}
          />

          {loading && (
            <div className="loader" role="status">
              <span className="spinner" aria-hidden="true" />
              Загрузка записей с сервера…
            </div>
          )}

          {!loading && visibleItems.length > 0 && (
            <ul className="list">
              {visibleItems.map((item) => (
                <AppointmentItem
                  key={item.id}
                  item={item}
                  doctor={getDoctor(item.doctorId)}
                  isEditing={item.id === editingId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </ul>
          )}

          {!loading && visibleItems.length === 0 && (
            <div className="empty">
              {isFiltered ? (
                <>
                  <p>По выбранным условиям записей не найдено.</p>
                  <button type="button" className="btn btn-small" onClick={clearFilters}>Сбросить фильтры</button>
                </>
              ) : (
                <p>Записей пока нет. Добавьте первую с помощью формы.</p>
              )}
            </div>
          )}

          <footer className="list-footer">
            <span className={`save-status save-${saveState.status}`} role="status" aria-live="polite">
              {saveState.status === 'saving' && 'Сохранение…'}
              {saveState.status === 'saved' && `Сохранено в localStorage в ${saveState.at.toLocaleTimeString('ru-RU')}`}
              {saveState.status === 'idle' && 'Изменения сохраняются автоматически'}
            </span>
            <button type="button" className="btn btn-small btn-ghost" onClick={handleReset} disabled={loading}>
              Сбросить к исходным данным
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
