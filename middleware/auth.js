const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/tokens');

/**
 * Проверка JWT: Authorization: Bearer <token>.
 * При успехе кладёт расшифрованный payload в req.user ({ id, email, ... }).
 */
module.exports = async function auth(req, res, next) {
  try {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
    if (!match) {
      throw new ApiError(401, 'Требуется авторизация: передайте заголовок Authorization: Bearer <token>');
    }

    const decoded = verifyToken(match[1], 'access');

    // JWT сам по себе «живёт» до истечения срока, поэтому дополнительно сверяемся с БД:
    // пользователь не удалён, e-mail подтверждён, токен не отозван сменой пароля
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'isVerified', 'tokenVersion'] });
    if (!user || !user.isVerified || user.tokenVersion !== decoded.tv) {
      throw new ApiError(401, 'Токен больше не действителен. Выполните вход заново');
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 401) {
      res.set('WWW-Authenticate', 'Bearer');
    }
    next(err);
  }
};
