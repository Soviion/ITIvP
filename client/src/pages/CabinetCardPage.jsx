import { useState } from 'react';
import { getErrorMessage, getFieldErrors, updatePatientProfile, updateRecord } from '../api';
import { useAuth } from '../auth/context';
import ListEditor from '../components/ListEditor';
import PatientFields from '../components/PatientFields';
import { formatShortDate } from '../utils/dates';
import { BLOOD_TYPES, SOCIAL_LABELS, ageOn, fullPatientName, validateProfile } from '../utils/patient';
import Banner from '../ui/Banner';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/toastContext';

const GENDER_LABELS = { male: 'Мужской', female: 'Женский' };

function Row({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || <span className="not-set">не указано</span>}</dd>
    </div>
  );
}

// Блок «Личные данные»: просмотр и редактирование без перезагрузки страницы
function PersonalData({ patient }) {
  const { updateMe } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(patient);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setValues(patient);
    setErrors({});
    setFormError('');
    setEditing(true);
  }

  const setField = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, ...(name === 'birthDate' ? { socialStatus: undefined, trustedPerson: undefined } : {}) }));
  };

  async function save(event) {
    event.preventDefault();
    const found = validateProfile(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError('');
    try {
      updateMe(await updatePatientProfile(values)); // шапка и карта обновятся сразу
      toast.success('Данные сохранены');
      setEditing(false);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card section">
      <header className="section-head">
        <div className="section-icon"><Icon name="user" size={20} /></div>
        <div>
          <h2>Личные данные</h2>
          <p>Анкета, заполненная при регистрации</p>
        </div>
        {!editing && <Button icon="pencil" onClick={startEdit}>Редактировать</Button>}
      </header>

      {!editing ? (
        <dl className="info-list">
          <Row label="ФИО">{fullPatientName(patient)}</Row>
          <Row label="Пол">{GENDER_LABELS[patient.gender]}</Row>
          <Row label="Дата рождения">{`${formatShortDate(patient.birthDate)} (${ageOn(patient.birthDate)} лет)`}</Row>
          <Row label="Социальный статус">{SOCIAL_LABELS[patient.socialStatus]}</Row>
          <Row label="Телефон">{patient.phone}</Row>
          <Row label="Адрес проживания">{patient.address}</Row>
          <Row label="Место работы или учёбы">{patient.workplace}</Row>
          <Row label="Доверенное лицо">{patient.trustedPerson}</Row>
        </dl>
      ) : (
        <form onSubmit={save} noValidate className="stack">
          {formError && <Banner kind="error">{formError}</Banner>}
          <PatientFields values={values} errors={errors} onChange={setField} />
          <div className="section-actions">
            <Button type="submit" variant="primary" loading={saving}>Сохранить</Button>
            <Button onClick={() => setEditing(false)} disabled={saving}>Отмена</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function CabinetCardPage() {
  const { patient, record, profile, profileError, retryProfile, updateMe } = useAuth();
  const toast = useToast();

  // Изменения карты применяются сразу, а при ошибке сервера возвращаются (как и в списке записей)
  async function saveRecord(changes) {
    const previous = record;
    updateMe({ record: { ...record, ...changes } });
    try {
      updateMe(await updateRecord(changes));
    } catch (error) {
      updateMe({ record: previous });
      toast.error(getErrorMessage(error), { title: 'Изменение не сохранено' });
    }
  }

  let content;
  if (profile === 'loading' && !patient) {
    content = <section className="card"><div className="state"><div className="state-loading"><Spinner size={22} /><span>Загружаем медицинскую карту…</span></div></div></section>;
  } else if (profile === 'error') {
    content = (
      <Banner kind="error" title="Не удалось загрузить карту" action={<Button size="sm" onClick={retryProfile}>Повторить</Button>}>{profileError}</Banner>
    );
  } else if (!patient || !record) {
    content = <section className="card"><div className="state state-center"><h3>Карточка не найдена</h3><p>Медицинская карта ведётся только для пациентов.</p></div></section>;
  } else {
    content = (
      <div className="sections">
        <section className="card section card-head">
          <div>
            <span className="card-number">Карта № {record.cardNumber}</span>
            <h2>{fullPatientName(patient)}</h2>
          </div>
          <label className="blood">
            <span>Группа крови</span>
            <select value={record.bloodType ?? ''} onChange={(event) => saveRecord({ bloodType: event.target.value || null })} aria-label="Группа крови">
              <option value="">Не указана</option>
              {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </section>

        <PersonalData patient={patient} />

        <ListEditor
          title="Заболевания"
          hint="Хронические и перенесённые заболевания, о которых должен знать врач"
          items={record.diseases}
          placeholder="Например, гипертония"
          emptyText="Заболевания не добавлены"
          onChange={(diseases) => saveRecord({ diseases })}
        />
        <ListEditor
          title="Принимаемые препараты"
          hint="Лекарства, которые вы принимаете постоянно, с дозировкой"
          items={record.medications}
          placeholder="Например, Эналаприл 10 мг утром"
          emptyText="Препараты не добавлены"
          onChange={(medications) => saveRecord({ medications })}
        />
      </div>
    );
  }

  return (
    <>
      <title>Медицинская карта — Клиника</title>
      <div className="page-head"><div><h1>Моя медицинская карта</h1></div></div>
      {content}
    </>
  );
}
