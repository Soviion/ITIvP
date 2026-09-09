let appointments = [
  {
    id: 1,
    patientName: 'Иванов Иван',
    doctor: 'Петрова А.С.',
    date: '2026-09-10',
    time: '09:30',
    reason: 'Плановый осмотр',
    status: 'scheduled',
  },
  {
    id: 2,
    patientName: 'Сидорова Мария',
    doctor: 'Кузнецов В.В.',
    date: '2026-09-10',
    time: '10:00',
    reason: 'Головная боль',
    status: 'scheduled',
  },
  {
    id: 3,
    patientName: 'Смирнов Пётр',
    doctor: 'Петрова А.С.',
    date: '2026-09-11',
    time: '14:15',
    reason: 'Повторный приём',
    status: 'completed',
  },
];

let nextId = appointments.length + 1;

function getNextId() {
  return nextId++;
}

module.exports = {
  appointments,
  getNextId,
};
