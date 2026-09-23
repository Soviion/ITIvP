const ApiError = require('../utils/ApiError');
const { parseId, getBody, pick } = require('../utils/request');

function assertRequired(data, required) {
  const missing = required.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length) {
    throw new ApiError(
      400,
      'Не заполнены обязательные поля',
      missing.map((field) => ({ field, message: 'Поле обязательно' })),
    );
  }
}


 // cобирает стандартные CRUD обработчики поверх модели Sequelize.
 // fields поля, которые клиент может передавать - разрешенные
 // required  обязательные поля для POST и PUT иначе 400 
 // prepare проверка входных данных даты, вторичных ключей
 
module.exports = function createCrudController({
  Model,
  itemKey,
  messages,
  fields,
  required,
  include = [],
  order = [['id', 'ASC']],
  prepare = async (data) => data,
}) {
  const findOrFail = async (id) => {
    const row = await Model.findByPk(id, { include });
    if (!row) throw new ApiError(404, messages.notFound(id));
    return row;
  };

  // PUT - необязательные поля которых нет в теле запроса - устанавливаются по умолчанию из модели или null
  const withDefaults = (data) => {
    const attributes = Model.getAttributes();
    const result = { ...data };
    fields.forEach((field) => {
      if (result[field] === undefined) {
        const { defaultValue } = attributes[field];
        result[field] = defaultValue === undefined ? null : defaultValue;
      }
    });
    return result;
  };

  return {
    getAll: async (req, res) => {
      res.json(await Model.findAll({ include, order }));
    },

    getById: async (req, res) => {
      res.json(await findOrFail(parseId(req)));
    },

    create: async (req, res) => {
      const picked = pick(getBody(req), fields);
      assertRequired(picked, required);
      const data = await prepare(picked);

      const created = await Model.sequelize.transaction((transaction) => Model.create(data, { transaction }));
      res.status(201).json(await findOrFail(created.id));
    },

    update: async (req, res) => {
      const id = parseId(req);
      const row = await findOrFail(id);
      const picked = pick(getBody(req), fields);
      assertRequired(picked, required);
      const data = await prepare(withDefaults(picked));

      await row.update(data);
      res.json(await findOrFail(id));
    },

    patch: async (req, res) => {
      const id = parseId(req);
      const row = await findOrFail(id);
      const picked = pick(getBody(req), fields);
      if (!Object.keys(picked).length) {
        throw new ApiError(400, `Не переданы поля для обновления. Допустимые поля: ${fields.join(', ')}`);
      }
      const data = await prepare(picked);

      await row.update(data);
      res.json(await findOrFail(id));
    },

    remove: async (req, res) => {
      const row = await findOrFail(parseId(req));
      await row.destroy();
      res.json({ message: messages.deleted, [itemKey]: row });
    },
  };
};
