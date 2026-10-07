const CARDS = [
  { key: 'total', label: 'Всего записей', tone: 'total' },
  { key: 'scheduled', label: 'Запланировано', tone: 'scheduled' },
  { key: 'completed', label: 'Завершено', tone: 'completed' },
  { key: 'missed', label: 'Отменено / не явились', tone: 'cancelled' },
];

export default function StatsPanel({ stats, loading }) {
  const values = { ...stats, missed: stats.cancelled + stats.no_show };

  return (
    <section className="stats" aria-label="Статистика">
      {CARDS.map((card) => (
        <div key={card.key} className={`stat stat-${card.tone}`}>
          <span className="stat-value">{loading ? '—' : values[card.key]}</span>
          <span className="stat-label">{card.label}</span>
        </div>
      ))}
    </section>
  );
}
