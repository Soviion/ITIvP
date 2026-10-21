import Icon from '../ui/Icon';

export default function CabinetHistoryPage() {
  return (
    <>
      <title>История болезни — Клиника</title>
      <div className="page-head"><div><h1>История болезни</h1></div></div>
      <section className="card">
        <div className="state state-center">
          <span className="state-icon"><Icon name="list" size={26} /></span>
          <h3>В разработке…</h3>
          <p>Здесь появятся результаты приёмов, назначения и выписки. Раздел будет доступен в одном из следующих обновлений.</p>
        </div>
      </section>
    </>
  );
}
