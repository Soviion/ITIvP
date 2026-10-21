import { useEffect, useEffectEvent, useState } from 'react';
import { fetchSlotDays, fetchSlots, getErrorMessage, isCanceled } from '../api';
import { parseISO } from '../utils/dates';
import Spinner from '../ui/Spinner';

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const month = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

const plural = (n) => {
  const rest = n % 100;
  if (rest > 10 && rest < 20) return 'талонов';
  return { 1: 'талон', 2: 'талона', 3: 'талона', 4: 'талона' }[n % 10] ?? 'талонов';
};

// Выбор даты и времени у конкретного врача. Значение хранит родитель: value = { date, time }, onChange получает изменения.
// numbered — оформление шагами «2 Выберите дату» и «3 Выберите время» (форма записи); excludeId — запись, которую переносят.
export default function SlotPicker({ doctorId, value, onChange, refreshKey = 0, excludeId, numbered = false }) {
  // key — для какого врача/даты получены данные: пока он не совпал с текущим выбором, показываем «загрузка»
  const [days, setDays] = useState({ key: null, list: [], error: '' });
  const [slots, setSlots] = useState({ key: null, list: [], error: '' });
  const daysKey = doctorId ? `${doctorId}:${excludeId ?? ''}` : null;
  const slotsKey = doctorId && value.date ? `${doctorId}:${value.date}:${excludeId ?? ''}` : null;

  // Событие эффекта: берёт самые свежие value и onChange, не перезапуская загрузку при их изменении
  const syncDays = useEffectEvent((list) => {
    const current = value.date;
    if (!(current && list.some((day) => day.date === current && day.free > 0))) {
      onChange({ date: list.find((day) => day.free > 0)?.date ?? null, time: null });
    }
  });
  const syncSlots = useEffectEvent((list) => {
    if (value.time && !list.some((slot) => slot.time === value.time && slot.free)) onChange({ time: null }); // время мог занять другой
  });

  // дни врача; если выбранной даты нет или в ней нет мест — берём первую подходящую
  useEffect(() => {
    if (!daysKey) return undefined;
    const controller = new AbortController();
    fetchSlotDays(doctorId, controller.signal, excludeId)
      .then((list) => { setDays({ key: daysKey, list, error: '' }); syncDays(list); })
      .catch((error) => { if (!isCanceled(error)) setDays({ key: daysKey, list: [], error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, [doctorId, excludeId, daysKey, refreshKey]);

  // талоны на выбранный день
  useEffect(() => {
    if (!slotsKey) return undefined;
    const controller = new AbortController();
    fetchSlots(doctorId, value.date, controller.signal, excludeId)
      .then((list) => { setSlots({ key: slotsKey, list, error: '' }); syncSlots(list); })
      .catch((error) => { if (!isCanceled(error)) setSlots({ key: slotsKey, list: [], error: getErrorMessage(error) }); });
    return () => controller.abort();
  }, [doctorId, value.date, excludeId, slotsKey, refreshKey]);

  const daysReady = days.key === daysKey;
  const slotsReady = slots.key === slotsKey;
  const daysLoading = Boolean(daysKey) && !daysReady;
  const slotsLoading = Boolean(slotsKey) && !slotsReady;

  const dateTitle = numbered ? (
    <header><span className="rstep-num">2</span><h2>Выберите дату</h2></header>
  ) : <h3 className="picker-title">Дата</h3>;
  const timeTitle = numbered ? (
    <header><span className="rstep-num">3</span><h2>Выберите время</h2></header>
  ) : <h3 className="picker-title">Время</h3>;
  const Block = numbered ? 'div' : 'section';

  return (
    <>
      <Block className={numbered ? `bstep ${doctorId ? '' : 'is-locked'}` : 'picker-block'}>
        {dateTitle}
        {!doctorId && <p className="bstep-hint">Сначала выберите врача</p>}
        {daysLoading && <div className="state-loading"><Spinner size={18} />Загружаем расписание…</div>}
        {daysReady && days.error && <p className="inline-error">{days.error}</p>}
        {daysReady && days.list.length > 0 && (
          <div className="days" role="group" aria-label="Дата приёма">
            {days.list.map((day) => {
              const date = parseISO(day.date);
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`day-btn ${day.date === value.date ? 'is-selected' : ''}`}
                  disabled={day.free === 0}
                  onClick={() => onChange({ date: day.date, time: null })}
                  aria-pressed={day.date === value.date}
                >
                  <span className="day-wd">{weekday.format(date)}</span>
                  <strong>{date.getDate()}</strong>
                  <span className="day-mo">{month.format(date).replace('.', '')}</span>
                  <span className="day-free">{day.free > 0 ? `${day.free} ${plural(day.free)}` : 'нет мест'}</span>
                </button>
              );
            })}
          </div>
        )}
      </Block>

      <Block className={numbered ? `bstep ${value.date ? '' : 'is-locked'}` : 'picker-block'}>
        {timeTitle}
        {!value.date && <p className="bstep-hint">Сначала выберите дату</p>}
        {slotsLoading && <div className="state-loading"><Spinner size={18} />Загружаем талоны…</div>}
        {slotsReady && slots.error && <p className="inline-error">{slots.error}</p>}
        {slotsReady && slots.list.length > 0 && (
          <div className="slots" role="group" aria-label="Время приёма">
            {slots.list.map((slot) => (
              <button
                key={slot.time}
                type="button"
                className={`slot ${slot.time === value.time ? 'is-selected' : ''}`}
                disabled={!slot.free}
                onClick={() => onChange({ time: slot.time })}
                aria-pressed={slot.time === value.time}
                title={slot.free ? 'Свободно' : 'Занято'}
              >
                {slot.time}
              </button>
            ))}
          </div>
        )}
      </Block>
    </>
  );
}
