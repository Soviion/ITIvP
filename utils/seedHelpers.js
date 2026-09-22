const withTimestamps = (rows) => {
  const now = new Date();
  return rows.map((row) => ({ ...row, created_at: now, updated_at: now }));
};

// Сиды вставляют строки с явными id — синхронизируем последовательность, чтобы новые записи не конфликтовали.
async function resetSequence(queryInterface, table) {
  await queryInterface.sequelize.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
  );
}

async function seedTable(queryInterface, table, rows) {
  await queryInterface.bulkInsert(table, withTimestamps(rows));
  await resetSequence(queryInterface, table);
}

module.exports = { seedTable };
