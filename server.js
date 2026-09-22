require('dotenv').config({ quiet: true });

const express = require('express');
const { sequelize } = require('./models');
const { notFound, errorHandler } = require('./middleware/errorHandler');

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

app.use('/appointments', appointmentsRouter);
app.use('/patients', patientsRouter);
app.use('/doctors', doctorsRouter);
app.use('/specialties', specialtiesRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
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
