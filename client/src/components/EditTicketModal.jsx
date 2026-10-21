import { useState } from 'react';
import { shortName } from '../utils/appointments';
import { formatDayHeading } from '../utils/dates';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import SlotPicker from './SlotPicker';

function EditForm({ item, onSave, onClose }) {
  const [value, setValue] = useState({ date: item.date, time: item.time });
  const [reason, setReason] = useState(item.reason ?? '');

  const changed = value.date !== item.date || value.time !== item.time || reason.trim() !== (item.reason ?? '');
  const complete = Boolean(value.date && value.time);

  function submit(event) {
    event.preventDefault();
    const changes = {};
    if (value.date !== item.date || value.time !== item.time) Object.assign(changes, { date: value.date, time: value.time });
    if (reason.trim() !== (item.reason ?? '')) changes.reason = reason.trim();
    onSave(item, changes);
  }

  return (
    <form onSubmit={submit} className="modal-form" noValidate>
      <div className="modal-body stack">
        <p className="muted">
          {shortName(item.doctor)}, {item.doctor?.specialty?.name}. Сейчас: {formatDayHeading(item.date).text.toLowerCase()}, {item.time}.
        </p>
        <SlotPicker doctorId={item.doctorId} excludeId={item.id} value={value} onChange={(change) => setValue((prev) => ({ ...prev, ...change }))} />
        <Field label="Описание (причина обращения)" optional hint={`${reason.length} / 1000`}>
          {(props) => <textarea {...props} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Жалобы, цель визита" />}
        </Field>
      </div>
      <footer className="modal-footer">
        <Button onClick={onClose}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={!changed || !complete}>Сохранить</Button>
      </footer>
    </form>
  );
}

// Изменение времени и описания своей записи. Время выбирается среди свободных талонов того же врача.
export default function EditTicketModal({ item, onSave, onClose }) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Изменить запись" subtitle="Время и описание приёма" size="md" bare>
      {item && <EditForm key={item.id} item={item} onSave={onSave} onClose={onClose} />}
    </Modal>
  );
}
