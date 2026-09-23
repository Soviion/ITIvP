const { Appointment, Patient, Doctor, Specialty } = require('../models');
const createCrudController = require('./createCrudController');
const ApiError = require('../utils/ApiError');
const { fromDisplayDate, fromDisplayTime } = require('../utils/dates');
const { ensureExists } = require('../utils/validators');
const { getBody } = require('../utils/request');

const STATUSES = Appointment.getAttributes().status.values;

// paranoid: false — в истории приёмов остаются данные удалённых (архивных) пациентов и врачей
const include = [
  {
    model: Patient,
    as: 'patient',
    attributes: ['id', 'lastName', 'firstName', 'middleName'],
    paranoid: false,
  },
  {
    model: Doctor,
    as: 'doctor',
    attributes: ['id', 'lastName', 'firstName', 'middleName'],
    paranoid: false,
    include: [{ model: Specialty, as: 'specialty', attributes: ['id', 'name'] }],
  },
];

const order = [['date', 'ASC'], ['time', 'ASC'], ['id', 'ASC']];

const crud = createCrudController({
  Model: Appointment,
  itemKey: 'appointment',
  messages: {
    notFound: (id) => `Запись с id=${id} не найдена`,
    deleted: 'Запись удалена',
  },
  fields: ['patientId', 'doctorId', 'date', 'time', 'durationMinutes', 'reason', 'status', 'cabinet'],
  required: ['patientId', 'doctorId', 'date', 'time'],
  include,
  order,
  async prepare(data) {
    if (data.date != null) data.date = fromDisplayDate(data.date);
    if (data.time != null) data.time = fromDisplayTime(data.time);
    if (data.patientId != null) {
      await ensureExists(Patient, data.patientId, 'patientId', 'Пациент');
    }
    if (data.doctorId != null) {
      await ensureExists(Doctor, data.doctorId, 'doctorId', 'Врач');
      if (!(await Doctor.count({ where: { id: data.doctorId, isActive: true } }))) {
        throw new ApiError(400, 'Врач сейчас не ведёт приём');
      }
    }
    return data;
  },
});

async function query(req, res) {
  const filters = getBody(req);
  const where = {};

  if (filters.status !== undefined) {
    if (!STATUSES.includes(filters.status)) {
      throw new ApiError(400, `Поле "status" должно быть одним из: ${STATUSES.join(', ')}`);
    }
    where.status = filters.status;
  }
  ['doctorId', 'patientId'].forEach((field) => {
    if (filters[field] !== undefined) {
      if (!Number.isInteger(filters[field])) {
        throw new ApiError(400, `Поле "${field}" должно быть целым числом`);
      }
      where[field] = filters[field];
    }
  });
  if (filters.date !== undefined) {
    where.date = fromDisplayDate(filters.date);
  }

  res.json(await Appointment.findAll({ where, include, order }));
}

module.exports = { ...crud, query };
