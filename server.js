const express = require('express');
const app = express();

const appointmentsRouter = require('./routes/appointments');
const ApiError = require('./utils/ApiError');

const PORT = process.env.PORT || 3000;

app.use(express.json()); // middleware

app.get('/', (req, res) => {
  res.json({ message: 'Clinic Management API' });
});

app.use('/appointments', appointmentsRouter);


app.use((req, res, next) => {
  next(new ApiError(404, `Маршрут ${req.method} ${req.originalUrl} не найден`));
});


app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    console.error(err);
  }
  res.status(statusCode).json({
    error: err.message || 'Внутренняя ошибка сервера',
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
