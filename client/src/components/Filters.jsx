import { SORT_OPTIONS, STATUSES } from '../constants';

export default function Filters({ query, onQueryChange, filter, onFilterChange, sort, onSortChange, stats }) {
  const chips = [{ value: 'all', label: 'Все', count: stats.total }, ...STATUSES.map((status) => ({ ...status, count: stats[status.value] }))];

  return (
    <div className="filters">
      <div className="filters-row">
        <input
          type="search"
          className="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по пациенту, врачу или причине…"
          aria-label="Поиск"
        />
        <select
          value={sort.by}
          onChange={(event) => onSortChange((prev) => ({ ...prev, by: event.target.value }))}
          aria-label="Сортировка"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => onSortChange((prev) => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
          title={sort.dir === 'asc' ? 'По возрастанию' : 'По убыванию'}
          aria-label="Направление сортировки"
        >
          {sort.dir === 'asc' ? '↑ А–Я' : '↓ Я–А'}
        </button>
      </div>

      <div className="chips" role="group" aria-label="Фильтр по статусу">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={`chip${filter === chip.value ? ' is-active' : ''}`}
            aria-pressed={filter === chip.value}
            onClick={() => onFilterChange(chip.value)}
          >
            {chip.label} <span className="chip-count">{chip.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
