const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { getBody } = require('../utils/request');
const { normalizeEmail, normalizeCode, requireString } = require('../utils/authInput');
const { assertStrongPassword } = require('../utils/passwordPolicy');
const { sha256, randomToken, encrypt, decrypt } = require('../utils/crypto');
const { jwt: jwtConfig, bcryptRounds, verification } = require('../config/auth');
const { signAccessToken, signTwoFactorToken, verifyToken } = require('../services/tokens');
const { sendVerificationEmail } = require('../services/mailer');
const twoFactor = require('../services/twoFactor');

// Хеш для «пустого» сравнения: время ответа не выдаёт, существует ли такой e-mail
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', bcryptRounds);

const sessionResponse = (user) => ({
  token: signAccessToken(user),
  tokenType: 'Bearer',
  expiresIn: jwtConfig.expiresIn,
  user,
});

// Новый токен подтверждения: в письмо уходит сам токен, в БД — только его SHA-256
async function sendNewVerification(user) {
  const token = randomToken();
  await user.update({
    emailVerificationTokenHash: sha256(token),
    emailVerificationExpires: new Date(Date.now() + verification.ttlHours * 60 * 60 * 1000),
  });
  try {
    await sendVerificationEmail(user.email, token);
    return true;
  } catch (err) {
    console.error(`Не удалось отправить письмо на ${user.email}: ${err.message}`);
    return false;
  }
}

function assertCodeResult(result, failStatus) {
  if (result === 'replay') {
    throw new ApiError(
      failStatus,
      'Этот код уже использован. Дождитесь следующего кода в приложении (он обновляется каждые 30 секунд)',
    );
  }
  if (result !== 'ok') {
    throw new ApiError(failStatus, 'Неверный код подтверждения');
  }
}

const htmlPage = (title, message, ok) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;background:#f4f7fb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:420px;text-align:center}
  h1{font-size:22px;margin:0 0 12px;color:${ok ? '#1a7f4b' : '#c0392b'}}
  p{color:#445;line-height:1.5;margin:0}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;

// Ссылку открывают из письма в браузере, поэтому браузеру отдаём страницу, остальным клиентам — JSON
function respondVerification(res, status, title, message) {
  res.status(status).format({
    json: () => res.json(status === 200 ? { message } : { error: message }),
    html: () => res.send(htmlPage(title, message, status === 200)),
  });
}

// ---------- Регистрация и подтверждение e-mail ----------

exports.register = async (req, res) => {
  const body = getBody(req);
  const email = normalizeEmail(body.email);
  const password = requireString(body.password, 'password');
  assertStrongPassword(password, { email });

  if (await User.count({ where: { email } })) {
    throw new ApiError(409, 'Пользователь с таким e-mail уже зарегистрирован');
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const user = await User.create({ email, passwordHash });
  const emailSent = await sendNewVerification(user);

  res.status(201).json({
    message: emailSent
      ? 'Регистрация выполнена. Мы отправили письмо со ссылкой для подтверждения e-mail'
      : 'Регистрация выполнена, но письмо отправить не удалось. Запросите повторную отправку: POST /auth/resend-verification',
    emailSent,
    user,
  });
};

exports.verifyEmail = async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const user = /^[a-f0-9]{64}$/.test(token)
    ? await User.findOne({
      where: {
        emailVerificationTokenHash: sha256(token),
        emailVerificationExpires: { [Op.gt]: new Date() },
      },
    })
    : null;

  if (!user) {
    return respondVerification(res, 400, 'Ссылка недействительна', 'Ссылка подтверждения недействительна или устарела. Запросите новое письмо.');
  }

  await user.update({ isVerified: true, emailVerificationTokenHash: null, emailVerificationExpires: null });
  return respondVerification(res, 200, 'E-mail подтверждён', 'Аккаунт активирован. Теперь можно войти в систему.');
};

exports.resendVerification = async (req, res) => {
  const email = normalizeEmail(getBody(req).email);
  const user = await User.findOne({ where: { email } });
  if (user && !user.isVerified) {
    await sendNewVerification(user);
  }
  // Ответ одинаков для любого e-mail — нельзя узнать, зарегистрирован ли адрес
  res.json({ message: 'Если такой e-mail зарегистрирован и ещё не подтверждён, мы отправили новое письмо' });
};

// ---------- Вход ----------

exports.login = async (req, res) => {
  const body = getBody(req);
  const email = normalizeEmail(body.email);
  const password = requireString(body.password, 'password');

  const user = await User.findOne({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new ApiError(401, 'Неверный e-mail или пароль');
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'E-mail не подтверждён. Перейдите по ссылке из письма или запросите новое: POST /auth/resend-verification');
  }

  if (user.twoFactorEnabled) {
    return res.json({
      twoFactorRequired: true,
      tempToken: signTwoFactorToken(user),
      message: 'Введите 6-значный код из Google Authenticator: POST /auth/login/2fa',
    });
  }

  return res.json(sessionResponse(user));
};

exports.loginTwoFactor = async (req, res) => {
  const body = getBody(req);
  const decoded = verifyToken(requireString(body.tempToken, 'tempToken'), '2fa');
  const code = normalizeCode(body.code);

  const user = await User.findByPk(decoded.id);
  if (!user || !user.isVerified || !user.twoFactorEnabled) {
    throw new ApiError(401, 'Недействительный токен');
  }

  assertCodeResult(await twoFactor.verifyUserCode(user, code), 401);
  res.json(sessionResponse(user));
};

// ---------- Смена пароля ----------

exports.changePassword = async (req, res) => {
  const body = getBody(req);
  const currentPassword = requireString(body.currentPassword, 'currentPassword');
  const newPassword = requireString(body.newPassword, 'newPassword');

  const user = await User.findByPk(req.user.id);
  assertStrongPassword(newPassword, { email: user.email });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(403, 'Текущий пароль указан неверно');
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new ApiError(400, 'Новый пароль должен отличаться от текущего');
  }

  await user.update({
    passwordHash: await bcrypt.hash(newPassword, bcryptRounds),
    tokenVersion: user.tokenVersion + 1,
  });

  res.json({
    message: 'Пароль изменён. Все ранее выданные токены отозваны, используйте новый',
    ...sessionResponse(user),
  });
};

// ---------- Двухфакторная аутентификация (Google Authenticator) ----------

exports.twoFactorSetup = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация уже включена');
  }

  const secret = twoFactor.generateSecret();
  await user.update({ twoFactorSecret: encrypt(secret), twoFactorLastStep: null });

  const otpauthUrl = twoFactor.buildOtpauthUri(secret, user.email);
  res.json({
    message: 'Отсканируйте QR-код в Google Authenticator (или введите ключ вручную), затем подтвердите: POST /auth/2fa/enable',
    secret,
    otpauthUrl,
    qrCode: await twoFactor.toQrDataUrl(otpauthUrl),
  });
};

// QR-код в виде картинки (удобно открыть в Postman или браузере и отсканировать с экрана)
exports.twoFactorQr = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация уже включена');
  }
  if (!user.twoFactorSecret) {
    throw new ApiError(400, 'Сначала вызовите POST /auth/2fa/setup');
  }

  const secret = decrypt(user.twoFactorSecret);
  res.type('image/png').send(await twoFactor.toQrPng(twoFactor.buildOtpauthUri(secret, user.email)));
};

exports.twoFactorEnable = async (req, res) => {
  const code = normalizeCode(getBody(req).code);

  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация уже включена');
  }
  if (!user.twoFactorSecret) {
    throw new ApiError(400, 'Сначала вызовите POST /auth/2fa/setup');
  }

  assertCodeResult(await twoFactor.verifyUserCode(user, code), 400);
  await user.update({ twoFactorEnabled: true });

  res.json({ message: 'Двухфакторная аутентификация включена. При входе потребуется код из Google Authenticator', user });
};

exports.twoFactorDisable = async (req, res) => {
  const body = getBody(req);
  const password = requireString(body.password, 'password');
  const code = normalizeCode(body.code);

  const user = await User.findByPk(req.user.id);
  if (!user.twoFactorEnabled) {
    throw new ApiError(409, 'Двухфакторная аутентификация не включена');
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(403, 'Пароль указан неверно');
  }

  assertCodeResult(await twoFactor.verifyUserCode(user, code), 400);
  await user.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null });

  res.json({ message: 'Двухфакторная аутентификация отключена', user });
};
