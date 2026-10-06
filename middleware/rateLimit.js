const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const create = ({ windowMs, limit, message, skipSuccessfulRequests = false }) => rateLimit({
  windowMs,
  limit,
  skipSuccessfulRequests,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  handler: (req, res, next) => next(new ApiError(429, message)),
});

module.exports = {
  // общий лимит на все маршруты /auth
  general: create({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: 'Слишком много запросов. Повторите попытку через несколько минут',
  }),
  // подбор пароля и кода из приложения: считаются только неудачные попытки
  credentials: create({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: 'Слишком много неудачных попыток. Повторите через 15 минут',
  }),
  // регистрация и повторная отправка писем
  mail: create({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    message: 'Слишком много писем запрошено. Повторите через час',
  }),
};
