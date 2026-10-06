require('dotenv').config({ quiet: true });

const express = require('express');
const { sequelize } = require('./models');
const { checkAuthConfig } = require('./config/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const auth = require('./middleware/auth');

const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const appointmentsRouter = require('./routes/appointments');
const patientsRouter = require('./routes/patients');
const doctorsRouter = require('./routes/doctors');
const specialtiesRouter = require('./routes/specialties');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Clinic Management API' });
});

// Аутентификация и профиль
app.use('/auth', authRouter);
app.use('/profile', profileRouter);

// Защищённые маршруты: персональные данные пациентов и записи на приём — только с JWT
app.use('/appointments', auth, appointmentsRouter);
app.use('/patients', auth, patientsRouter);
// Врачи и специальности: чтение открыто, изменение врачей закрыто внутри routes/doctors.js
app.use('/doctors', doctorsRouter);
app.use('/specialties', specialtiesRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  const { errors, warnings } = checkAuthConfig();
  if (errors.length) {
    console.error(`Ошибка конфигурации (.env):\n - ${errors.join('\n - ')}`);
    process.exit(1);
  }
  warnings.forEach((warning) => console.warn(`Предупреждение: ${warning}`));

  try {
    await sequelize.authenticate();
    console.log('PostgreSQL: connection established');
  } catch (err) {
    console.error(`PostgreSQL: connection failed - ${err.message}`);
    process.exit(1);
  }

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start();
