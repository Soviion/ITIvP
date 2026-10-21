const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, Patient, MedicalRecord, Doctor, Appointment, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { getBody, parseId } = require('../utils/request');
const { normalizeEmail, normalizeCode, requireString } = require('../utils/authInput');
const { fromDisplayDate, fromDisplayTime, toDisplayDate } = require('../utils/dates');
const { validatePatientProfile } = require('../utils/patientProfile');
const { SLOT_TIMES, SLOT_MINUTES, bookableDates, slotsFor, loadBusy, toMinutes, todayIso } = require('../utils/schedule');
const { signAccessToken } = require('../services/tokens');
const { sendCodeEmail } = require('../services/mailer');
const { issueCode, discardCode, checkCode, CODE_TTL_MINUTES, RESEND_SECONDS } = require('../services/emailCodes');
const appointmentInclude = require('../services/appointmentInclude');
const { jwt: jwtConfig } = require('../config/auth');

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const MAX_ACTIVE_APPOINTMENTS = 4; // больше активных талонов у одного пациента быть не может
const MAX_LIST_ITEMS = 30;
const MAX_ITEM_LENGTH = 120;

const loadPatient = (userId) => Patient.findOne({ where: { userId }, include: [{ model: MedicalRecord, as: 'medicalRecord' }] });

async function patientOrFail(req) {
  const patient = await loadPatient(req.user.id);
  if (!patient) throw new ApiError(404, 'Карточка пациента не найдена. Личный кабинет доступен только пациентам');
  return patient;
}

const recordView = (record) => (record ? {
  id: record.id,
  cardNumber: record.cardNumber,
  bloodType: record.bloodType,
  diseases: record.diseases,
  medications: record.medications,
} : null);

const meView = async (userId) => {
  const user = await User.findByPk(userId);
  const patient = await loadPatient(userId);
  const json = patient ? patient.toJSON() : null;
  if (json) delete json.medicalRecord;
  return { user, patient: json, record: recordView(patient?.medicalRecord) };
};

// GET /me — пользователь, карточка пациента и медицинская карта одним ответом
exports.getMe = async (req, res) => {
  res.json(await meView(req.user.id));
};

// PATCH /me/patient — изменение анкеты. Недостающие поля берём из текущей карточки и проверяем анкету целиком.
exports.updatePatient = async (req, res) => {
  const patient = await patientOrFail(req);
  const body = getBody(req);
  const current = {
    ...patient.get({ plain: true }),
    noMiddleName: patient.middleName === null,
    birthDate: toDisplayDate(patient.birthDate),
  };
  const merged = { ...current };
  ['lastName', 'firstName', 'middleName', 'noMiddleName', 'birthDate', 'gender', 'socialStatus', 'phone', 'address', 'workplace', 'trustedPerson']
    .forEach((field) => { if (body[field] !== undefined) merged[field] = body[field]; });

  const values = validatePatientProfile(merged);
  if (values.phone !== patient.phone && await Patient.count({ where: { phone: values.phone, userId: { [Op.ne]: null }, id: { [Op.ne]: patient.id } } })) {
    throw new ApiError(400, 'Проверьте данные анкеты', [{ field: 'phone', message: 'Этот номер уже привязан к другому аккаунту' }]);
  }
  await patient.update(values);
  res.json(await meView(req.user.id));
};

function cleanList(value, label) {
  if (!Array.isArray(value)) throw new ApiError(400, `Поле "${label}" должно быть списком`);
  const seen = new Set();
  const list = [];
  value.forEach((item) => {
    const text = typeof item === 'string' ? item.trim().replace(/\s+/g, ' ') : '';
    if (!text) return;
    if (text.length > MAX_ITEM_LENGTH) throw new ApiError(400, `Элемент списка не длиннее ${MAX_ITEM_LENGTH} символов`);
    if (!seen.has(text.toLowerCase())) { seen.add(text.toLowerCase()); list.push(text); }
  });
  if (list.length > MAX_LIST_ITEMS) throw new ApiError(400, `В списке не больше ${MAX_LIST_ITEMS} элементов`);
  return list;
}

// PATCH /me/record — группа крови, заболевания, препараты
exports.updateRecord = async (req, res) => {
  const patient = await patientOrFail(req);
  const body = getBody(req);
  const changes = {};

  if (body.bloodType !== undefined) {
    if (body.bloodType !== null && body.bloodType !== '' && !BLOOD_TYPES.includes(body.bloodType)) {
      throw new ApiError(400, `Группа крови должна быть одной из: ${BLOOD_TYPES.join(', ')}`);
    }
    changes.bloodType = body.bloodType || null;
  }
  if (body.diseases !== undefined) changes.diseases = cleanList(body.diseases, 'diseases');
  if (body.medications !== undefined) changes.medications = cleanList(body.medications, 'medications');
  if (!Object.keys(changes).length) throw new ApiError(400, 'Не переданы поля для обновления: bloodType, diseases, medications');

  await patient.medicalRecord.update(changes);
  res.json(await meView(req.user.id));
};

// ---------- Талоны пациента ----------

const findOwn = async (patientId, id) => {
  const appointment = await Appointment.findOne({ where: { id, patientId }, include: appointmentInclude() });
  if (!appointment) throw new ApiError(404, `Запись с id=${id} не найдена`);
  return appointment;
};

const hasStarted = (appointment) => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return appointment.date < todayIso() || (appointment.date === todayIso() && toMinutes(appointment.time) <= nowMinutes);
};

const countActive = (patientId) => Appointment.count({
  where: { patientId, status: { [Op.ne]: 'cancelled' }, date: { [Op.gte]: todayIso() } },
});

// GET /me/appointments — все записи пациента; деление на активные и архив делает клиент
exports.listAppointments = async (req, res) => {
  const patient = await patientOrFail(req);
  res.json(await Appointment.findAll({
    where: { patientId: patient.id },
    include: appointmentInclude(),
    order: [['date', 'ASC'], ['time', 'ASC'], ['id', 'ASC']],
  }));
};

// POST /me/appointments — записаться на свободный талон
exports.book = async (req, res) => {
  const patient = await patientOrFail(req);
  const body = getBody(req);

  const doctorId = Number(body.doctorId);
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new ApiError(400, 'Выберите врача');
  const doctor = await Doctor.findOne({ where: { id: doctorId, isActive: true } });
  if (!doctor) throw new ApiError(404, 'Врач не найден или не ведёт приём');

  const date = fromDisplayDate(body.date, 'date');
  const time = fromDisplayTime(body.time, 'time');
  if (!bookableDates().includes(date) || !SLOT_TIMES.includes(time)) {
    throw new ApiError(400, 'На это время запись недоступна. Выберите другой талон');
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > 1000) throw new ApiError(400, 'Причина обращения: не больше 1000 символов');

  if (await countActive(patient.id) >= MAX_ACTIVE_APPOINTMENTS) {
    throw new ApiError(409, `Можно иметь не больше ${MAX_ACTIVE_APPOINTMENTS} активных записей. Отмените одну из них, чтобы записаться снова`);
  }

  const busy = await loadBusy(Appointment, doctor.id, [date]);
  const slot = slotsFor(date, busy.get(date)).find((item) => item.time === time);
  if (!slot?.free) throw new ApiError(409, 'Этот талон уже занят. Выберите другое время');

  // пациент не может быть на двух приёмах одновременно
  const mine = await Appointment.findAll({ where: { patientId: patient.id, date, status: { [Op.ne]: 'cancelled' } }, raw: true });
  const start = toMinutes(time);
  if (mine.some((a) => start < toMinutes(a.time) + a.durationMinutes && start + SLOT_MINUTES > toMinutes(a.time))) {
    throw new ApiError(409, 'У вас уже есть запись на это время');
  }

  const created = await Appointment.create({
    patientId: patient.id, doctorId: doctor.id, date, time, durationMinutes: SLOT_MINUTES, reason: reason || null, status: 'scheduled',
  });
  res.status(201).json(await findOwn(patient.id, created.id));
};

// POST /me/appointments/:id/cancel — отменить свой будущий талон
exports.cancel = async (req, res) => {
  const patient = await patientOrFail(req);
  const appointment = await findOwn(patient.id, parseId(req));
  if (appointment.status !== 'scheduled') throw new ApiError(409, 'Отменить можно только запланированный приём');

  if (hasStarted(appointment)) throw new ApiError(409, 'Приём уже начался или прошёл, отменить его нельзя');
  await appointment.update({ status: 'cancelled' });
  res.json(await findOwn(patient.id, appointment.id));
};

// PATCH /me/appointments/:id — изменить время (в пределах расписания того же врача) и/или описание
exports.updateAppointment = async (req, res) => {
  const patient = await patientOrFail(req);
  const appointment = await findOwn(patient.id, parseId(req));
  const body = getBody(req);

  if (appointment.status !== 'scheduled') throw new ApiError(409, 'Изменить можно только запланированный приём');
  if (hasStarted(appointment)) throw new ApiError(409, 'Приём уже начался или прошёл, изменить его нельзя');

  const changes = {};
  if (body.reason !== undefined) {
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length > 1000) throw new ApiError(400, 'Причина обращения: не больше 1000 символов');
    changes.reason = reason || null;
  }

  if (body.date !== undefined || body.time !== undefined) {
    const date = body.date !== undefined ? fromDisplayDate(body.date, 'date') : appointment.date;
    const time = body.time !== undefined ? fromDisplayTime(body.time, 'time') : appointment.time.slice(0, 5);
    if (date !== appointment.date || time !== appointment.time.slice(0, 5)) {
      if (!bookableDates().includes(date) || !SLOT_TIMES.includes(time)) {
        throw new ApiError(400, 'На это время запись недоступна. Выберите другой талон');
      }
      const busy = await loadBusy(Appointment, appointment.doctorId, [date], appointment.id);
      const slot = slotsFor(date, busy.get(date)).find((item) => item.time === time);
      if (!slot?.free) throw new ApiError(409, 'Этот талон уже занят. Выберите другое время');

      const mine = await Appointment.findAll({
        where: { patientId: patient.id, date, status: { [Op.ne]: 'cancelled' }, id: { [Op.ne]: appointment.id } },
        raw: true,
      });
      const start = toMinutes(time);
      if (mine.some((a) => start < toMinutes(a.time) + a.durationMinutes && start + SLOT_MINUTES > toMinutes(a.time))) {
        throw new ApiError(409, 'У вас уже есть запись на это время');
      }
      changes.date = date;
      changes.time = time;
    }
  }
  if (!Object.keys(changes).length) throw new ApiError(400, 'Нет изменений: передайте date, time или reason');

  await appointment.update(changes);
  res.json(await findOwn(patient.id, appointment.id));
};

// ---------- Смена почты ----------

// POST /me/email/start — проверяем пароль и отправляем код на НОВЫЙ адрес
exports.emailStart = async (req, res) => {
  const body = getBody(req);
  const newEmail = normalizeEmail(body.newEmail);
  const password = requireString(body.password, 'password');

  const user = await User.findByPk(req.user.id);
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(403, 'Пароль указан неверно');
  if (newEmail === user.email) throw new ApiError(400, 'Это ваша текущая почта');
  if (await User.count({ where: { email: newEmail } })) throw new ApiError(409, 'Эта почта уже используется другим аккаунтом');

  const code = await issueCode({ email: newEmail, purpose: 'change_email', userId: user.id });
  try {
    await sendCodeEmail(newEmail, code, 'change_email', CODE_TTL_MINUTES);
  } catch (err) {
    console.error(`Не удалось отправить код на ${newEmail}: ${err.message}`);
    await discardCode({ email: newEmail, purpose: 'change_email' });
    throw new ApiError(502, 'Не удалось отправить письмо. Проверьте адрес или повторите позже');
  }
  res.json({ message: `Код отправлен на ${newEmail}`, resendAfterSeconds: RESEND_SECONDS });
};

// POST /me/email/confirm — код верный: меняем почту, отзываем старые токены, выдаём новый
exports.emailConfirm = async (req, res) => {
  const body = getBody(req);
  const newEmail = normalizeEmail(body.newEmail);
  const code = normalizeCode(body.code);

  const row = await checkCode({ email: newEmail, purpose: 'change_email', code });
  if (row.userId !== req.user.id) throw new ApiError(400, 'Код запрашивался для другого аккаунта');
  if (await User.count({ where: { email: newEmail } })) throw new ApiError(409, 'Эта почта уже используется другим аккаунтом');

  const user = await User.findByPk(req.user.id);
  await sequelize.transaction(async (transaction) => {
    await user.update({ email: newEmail, tokenVersion: user.tokenVersion + 1 }, { transaction });
    await Patient.update({ email: newEmail }, { where: { userId: user.id }, transaction });
  });

  res.json({
    message: 'Почта изменена',
    token: signAccessToken(user),
    tokenType: 'Bearer',
    expiresIn: jwtConfig.expiresIn,
    user,
  });
};
