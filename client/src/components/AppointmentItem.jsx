import { memo } from 'react';
import { STATUSES } from '../constants';
import { formatDate } from '../utils/appointments';

function AppointmentItem({ item, doctor, isEditing, onEdit, onDelete, onStatusChange }) {
  return (
    <li className={`item status-${item.status}${isEditing ? ' is-editing' : ''}`}>
      <div className="item-when">
        <strong>{item.time}</strong>
        <span>{formatDate(item.date)}</span>
      </div>

      <div className="item-main">
        <h3>{item.patientName}</h3>
        <p className="item-doctor">{doctor ? `${doctor.name} · ${doctor.specialty}` : 'Врач не найден'}</p>
        {item.reason && <p className="item-reason">{item.reason}</p>}
      </div>

      <div className="item-actions">
        <select
          className={`badge badge-${item.status}`}
          value={item.status}
          onChange={(event) => onStatusChange(item.id, event.target.value)}
          aria-label={`Статус записи ${item.patientName}`}
        >
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
        <div className="item-buttons">
          <button type="button" className="btn btn-small" onClick={() => onEdit(item)}>Изменить</button>
          <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(item.id)}>Удалить</button>
        </div>
      </div>
    </li>
  );
}

export default memo(AppointmentItem);
