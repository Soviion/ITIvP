const nodemailer = require('nodemailer');
const { smtp, verification } = require('../config/auth');

let transporter;

function getTransporter() {
  if (!smtp.user || !smtp.pass) {
    throw new Error('SMTP не настроен: задайте SMTP_USER и SMTP_PASS в .env');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

async function sendVerificationEmail(to, token) {
  const link = `${verification.baseUrl}/auth/verify-email?token=${token}`;
  const hours = verification.ttlHours;

  await getTransporter().sendMail({
    from: smtp.from,
    to,
    subject: 'Подтверждение e-mail — Clinic API',
    text: [
      'Вы зарегистрировались в Clinic API.',
      'Чтобы активировать аккаунт, перейдите по ссылке:',
      link,
      '',
      `Ссылка действует ${hours} ч. Если вы не регистрировались, просто проигнорируйте это письмо.`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#223">
        <h2>Подтверждение e-mail</h2>
        <p>Вы зарегистрировались в Clinic API. Чтобы активировать аккаунт, нажмите кнопку:</p>
        <p><a href="${link}" style="display:inline-block;background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Подтвердить e-mail</a></p>
        <p>Или откройте ссылку в браузере:<br><a href="${link}">${link}</a></p>
        <p style="color:#777;font-size:13px">Ссылка действует ${hours} ч. Если вы не регистрировались, просто проигнорируйте это письмо.</p>
      </div>`,
  });
}

// Проверка настроек SMTP (npm run mail:check)
async function verifyConnection() {
  await getTransporter().verify();
}

async function sendTestEmail() {
  await getTransporter().sendMail({
    from: smtp.from,
    to: smtp.user,
    subject: 'Тестовое письмо — Clinic API',
    text: 'SMTP настроен корректно: письма из Clinic API отправляются.',
  });
}

module.exports = { sendVerificationEmail, verifyConnection, sendTestEmail };
