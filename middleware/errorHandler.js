const {
  ValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  ConnectionError,
} = require('sequelize');
const ApiError = require('../utils/ApiError');

// Понятные сообщения для именованных ограничений БД
const CONSTRAINT_MESSAGES = {
  appointments_doctor_slot_unique: 'Врач уже занят на это время',
  doctors_email_unique: 'Врач с таким e-mail уже существует',
  patients_insurance_number_unique: 'Пациент с таким номером полиса уже существует',
  queue_tickets_doctor_day_number_unique: 'Такой номер в очереди врача на эту дату уже занят',
};

function notFound(req, res, next) {
  next(new ApiError(404, `Маршрут ${req.method} ${req.originalUrl} не найден`));
}

function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'Некорректный JSON в теле запроса');
  }
  if (err instanceof UniqueConstraintError) {
    const message = CONSTRAINT_MESSAGES[err.parent?.constraint]
      || `Запись с такими значениями уже существует (${Object.keys(err.fields || {}).join(', ')})`;
    return new ApiError(409, message);
  }
  if (err instanceof ValidationError) {
    return new ApiError(
      400,
      'Ошибка валидации данных',
      err.errors.map((item) => ({ field: item.path, message: item.message })),
    );
  }
  if (err instanceof ForeignKeyConstraintError) {
    return new ApiError(409, 'Операция нарушает связи между данными: связанная запись не найдена или используется');
  }
  if (err instanceof ConnectionError) {
    return new ApiError(503, 'База данных недоступна');
  }
  return err;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = toApiError(err);
  const statusCode = apiError.statusCode || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { error: statusCode === 500 ? 'Внутренняя ошибка сервера' : apiError.message };
  if (apiError.details) body.details = apiError.details;
  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
