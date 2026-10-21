const nodemailer = require('nodemailer');
const { smtp } = require('../config/auth');

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

const SUBJECTS = {
  register: 'Код подтверждения почты — Клиника',
  change_email: 'Код для смены почты — Клиника',
};

// Письмо с одноразовым 6-значным кодом (регистрация и смена почты)
async function sendCodeEmail(to, code, purpose, ttlMinutes) {
  const action = purpose === 'change_email' ? 'смены почты в личном кабинете' : 'регистрации в личном кабинете пациента';
  await getTransporter().sendMail({
    from: smtp.from,
    to,
    subject: SUBJECTS[purpose],
    text: [
      `Код для ${action}: ${code}`,
      '',
      `Код действует ${ttlMinutes} минут. Если вы его не запрашивали, просто проигнорируйте письмо.`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#18231f">
        <h2 style="margin:0 0 12px">Код подтверждения</h2>
        <p>Код для ${action}:</p>
        <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:16px 0;color:#0d7a66">${code}</p>
        <p style="color:#76817b;font-size:13px">Код действует ${ttlMinutes} минут. Если вы его не запрашивали, просто проигнорируйте письмо.</p>
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

module.exports = { sendCodeEmail, verifyConnection, sendTestEmail };
