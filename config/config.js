require('dotenv').config({ quiet: true });

// Sequelize определяет диалект по протоколу URL, поэтому приводим к виду postgres://
// (например, postgresql+psycopg:// из Python-проектов иначе не поддерживается).
const url = (process.env.DATABASE_URL || '').replace(/^postgres(?:ql)?(?:\+\w+)?:/, 'postgres:');

const common = {
  url,
  dialect: 'postgres',
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  typeValidation: true,
  dialectOptions: process.env.DB_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
};

module.exports = {
  development: { ...common },
  production: { ...common },
};
