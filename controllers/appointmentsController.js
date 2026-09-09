const { appointments, getNextId } = require('../models/appointments');
const ApiError = require('../utils/ApiError');

const ALLOWED_STATUSES = ['scheduled', 'completed', 'cancelled'];

function validateAppointmentPayload(body, { partial = false } = {}) {
  const { patientName, doctor, date, time, reason, status } = body;

  if (!partial || patientName !== undefined) {
    if (typeof patientName !== 'string' || !patientName.trim()) {
      throw new ApiError(400, 'Поле "patientName" обязательно и должно быть непустой строкой');
    }
  }
  if (!partial || doctor !== undefined) {
    if (typeof doctor !== 'string' || !doctor.trim()) {
      throw new ApiError(400, 'Поле "doctor" обязательно и должно быть непустой строкой');
    }
  }
  if (!partial || date !== undefined) {
    if (typeof date !== 'string' || !/^\d{2}-\d{2}-\d{4}$/.test(date)) { // dd-mm-yyyy
      throw new ApiError(400, 'Поле "date" обязательно и должно быть в формате dd-mm-yyyy');
    }
  }
  if (!partial || time !== undefined) {
    if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
      throw new ApiError(400, 'Поле "time" обязательно и должно быть в формате HH:MM');
    }
  }
  if (reason !== undefined && typeof reason !== 'string') {
    throw new ApiError(400, 'Поле "reason" должно быть строкой');
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(400, `Поле "status" должно быть одним из: ${ALLOWED_STATUSES.join(', ')}`);
  }
}

function findAppointmentOrFail(id) {
  const appointment = appointments.find((a) => a.id === id);
  if (!appointment) {
    throw new ApiError(404, `Запись с id=${id} не найдена`);
  }
  return appointment;
}

exports.getAllAppointments = (req, res) => {
  res.json(appointments);
};

// HTTP QUERY — как GET, но с телом запроса: { "status": "completed" }
exports.queryAppointments = (req, res) => {
  const { status } = req.body || {};

  if (status) {
    return res.json(appointments.filter((a) => a.status === status));
  }

  res.json(appointments);
};

exports.getAppointmentById = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'Параметр "id" должен быть целым числом');
  }
  const appointment = findAppointmentOrFail(id);
  res.json(appointment);
};

exports.createAppointment = (req, res) => {
  validateAppointmentPayload(req.body);

  const newAppointment = {
    id: getNextId(),
    patientName: req.body.patientName.trim(),
    doctor: req.body.doctor.trim(),
    date: req.body.date,
    time: req.body.time,
    reason: req.body.reason ? req.body.reason.trim() : '',
    status: req.body.status || 'scheduled',
  };

  appointments.push(newAppointment);
  res.status(201).json(newAppointment);
};

exports.updateAppointment = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'Параметр "id" должен быть целым числом');
  }
  const appointment = findAppointmentOrFail(id);
  validateAppointmentPayload(req.body);

  appointment.patientName = req.body.patientName.trim();
  appointment.doctor = req.body.doctor.trim();
  appointment.date = req.body.date;
  appointment.time = req.body.time;
  appointment.reason = req.body.reason ? req.body.reason.trim() : '';
  appointment.status = req.body.status || 'scheduled';

  res.json(appointment);
};

exports.patchAppointment = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'Параметр "id" должен быть целым числом');
  }
  const appointment = findAppointmentOrFail(id);
  validateAppointmentPayload(req.body, { partial: true });

  const { patientName, doctor, date, time, reason, status } = req.body;
  if (patientName !== undefined) appointment.patientName = patientName.trim();
  if (doctor !== undefined) appointment.doctor = doctor.trim();
  if (date !== undefined) appointment.date = date;
  if (time !== undefined) appointment.time = time;
  if (reason !== undefined) appointment.reason = reason.trim();
  if (status !== undefined) appointment.status = status;

  res.json(appointment);
};

exports.deleteAppointment = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'Параметр "id" должен быть целым числом');
  }
  const index = appointments.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new ApiError(404, `Запись с id=${id} не найдена`);
  }
  const [deleted] = appointments.splice(index, 1);
  res.json({ message: 'Запись удалена', appointment: deleted });
};
