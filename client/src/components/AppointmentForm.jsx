import { useEffect, useRef } from 'react';
import { DOCTORS, STATUSES } from '../constants';

// Контролируемая форма: значения полей хранит родительский компонент (draft),
// а форма только показывает их и сообщает об изменениях.
export default function AppointmentForm({ draft, errors, editingId, onFieldChange, onSubmit, onCancel }) {
  const nameRef = useRef(null);
  const isEditing = editingId !== null;

  // При переходе в режим редактирования переводим фокус на первое поле
  useEffect(() => {
    if (isEditing) nameRef.current?.focus();
  }, [isEditing, editingId]);

  const handleChange = (event) => onFieldChange(event.target.name, event.target.value);

  const bind = (name) => ({
    id: `field-${name}`,
    name,
    value: draft[name],
    onChange: handleChange,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `error-${name}` : undefined,
  });

  const error = (name) => errors[name] && (
    <p className="field-error" id={`error-${name}`} role="alert">{errors[name]}</p>
  );

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="field-patientName">Пациент (ФИО)</label>
        <input {...bind('patientName')} ref={nameRef} type="text" placeholder="Например, Иванов Иван" autoComplete="off" />
        {error('patientName')}
      </div>

      <div className="field">
        <label htmlFor="field-doctorId">Врач</label>
        <select {...bind('doctorId')}>
          <option value="">Выберите врача…</option>
          {DOCTORS.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.specialty}</option>
          ))}
        </select>
        {error('doctorId')}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="field-date">Дата</label>
          <input {...bind('date')} type="date" />
          {error('date')}
        </div>
        <div className="field">
          <label htmlFor="field-time">Время</label>
          <input {...bind('time')} type="time" />
          {error('time')}
        </div>
      </div>

      <div className="field">
        <label htmlFor="field-reason">Причина обращения</label>
        <input {...bind('reason')} type="text" placeholder="Необязательно" autoComplete="off" />
      </div>

      <div className="field">
        <label htmlFor="field-status">Статус</label>
        <select {...bind('status')}>
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {isEditing ? 'Сохранить изменения' : 'Добавить запись'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {isEditing ? 'Отмена' : 'Очистить'}
        </button>
      </div>
    </form>
  );
}
