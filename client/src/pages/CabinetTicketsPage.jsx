import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import EditTicketModal from '../components/EditTicketModal';
import { ErrorState, LoadingState } from '../components/ListStates';
import TicketCard from '../components/TicketCard';
import useMyAppointments from '../hooks/useMyAppointments';
import { formatShortDate } from '../utils/dates';
import { MAX_ACTIVE_TICKETS, byTimeAsc, byTimeDesc, isActiveTicket } from '../utils/tickets';
import Banner from '../ui/Banner';
import Icon from '../ui/Icon';

export default function CabinetTicketsPage() {
  const { items, status, error, reload, cancel, edit } = useMyAppointments();
  const [tab, setTab] = useState('active'); // active | archive
  const [toCancel, setToCancel] = useState(null);
  const [toEdit, setToEdit] = useState(null);

  const active = useMemo(() => items.filter(isActiveTicket).sort(byTimeAsc), [items]);
  const archive = useMemo(() => items.filter((item) => !isActiveTicket(item)).sort(byTimeDesc), [items]);
  const shown = tab === 'active' ? active : archive;

  async function confirmCancel() {
    const item = toCancel;
    setToCancel(null);
    await cancel(item);
  }

  async function saveEdit(item, changes) {
    setToEdit(null);
    await edit(item, changes);
  }

  const limitReached = status === 'ready' && active.length >= MAX_ACTIVE_TICKETS;

  return (
    <>
      <title>Мои талоны — Клиника</title>
      <div className="page-head">
        <div>
          <h1>Мои талоны</h1>
          <p>
            {status === 'ready' ? `Активных талонов: ${active.length} из ${MAX_ACTIVE_TICKETS}. ` : ''}Талоны сегодняшнего дня остаются в активных до конца суток.
          </p>
        </div>
        <Link to="/" className="btn btn-primary"><Icon name="plus" size={16} />Записаться к врачу</Link>
      </div>

      {limitReached && <Banner kind="warn" title="Достигнут лимит записей">Можно иметь не больше {MAX_ACTIVE_TICKETS} активных талонов. Отмените один из них, чтобы записаться снова.</Banner>}

      <div className="tabs" role="tablist" aria-label="Талоны">
        <button type="button" role="tab" aria-selected={tab === 'active'} className={`tab ${tab === 'active' ? 'is-active' : ''}`} onClick={() => setTab('active')}>
          Активные{status === 'ready' && <span className="tab-count">{active.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'archive'} className={`tab ${tab === 'archive' ? 'is-active' : ''}`} onClick={() => setTab('archive')}>
          Архив{status === 'ready' && <span className="tab-count">{archive.length}</span>}
        </button>
      </div>

      <section className="card list tickets" aria-label="Список талонов">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={reload} />}
        {status === 'ready' && shown.length === 0 && (
          <div className="state state-center">
            <span className="state-icon"><Icon name="calendar" size={26} /></span>
            <h3>{tab === 'active' ? 'Нет ближайших записей' : 'Архив пуст'}</h3>
            <p>{tab === 'active' ? 'Выберите врача, дату и время — свободные талоны доступны на ближайшие две недели.' : 'Прошедшие и отменённые талоны появятся здесь.'}</p>
            {tab === 'active' && <Link to="/" className="btn btn-primary">Записаться к врачу</Link>}
          </div>
        )}
        {status === 'ready' && shown.length > 0 && (
          <ul>
            {shown.map((item) => <TicketCard key={item.id} item={item} onCancel={tab === 'active' ? setToCancel : undefined} onEdit={tab === 'active' ? setToEdit : undefined} />)}
          </ul>
        )}
      </section>

      <EditTicketModal item={toEdit} onSave={saveEdit} onClose={() => setToEdit(null)} />

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Отменить запись?"
        confirmLabel="Отменить запись"
        danger
        onConfirm={confirmCancel}
        onClose={() => setToCancel(null)}
      >
        {toCancel && <p className="confirm-text">Талон на {formatShortDate(toCancel.date)} в {toCancel.time} будет отменён, время освободится для других пациентов.</p>}
      </ConfirmDialog>
    </>
  );
}
