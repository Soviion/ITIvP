const ApiError = require('../utils/ApiError');

// Ограничивает маршрут ролями. Подключается после middleware/auth, который кладёт роль в req.user.
module.exports = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(new ApiError(403, 'Недостаточно прав для этого действия'));
  }
  return next();
};
