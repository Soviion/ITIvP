const ApiError = require('./ApiError');

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Параметр "id" должен быть положительным целым числом');
  }
  return id;
}


function getBody(req) {
  const body = req.body;
  if (body === undefined) return {};
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'Тело запроса должно быть JSON-объектом');
  }
  return body;
}

function pick(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

module.exports = { parseId, getBody, pick };
