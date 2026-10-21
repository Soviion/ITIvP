const express = require('express');
const controller = require('../controllers/meController');
const limiters = require('../middleware/rateLimit');

// Личный кабинет: все маршруты уже за middleware/auth (см. server.js)
const router = express.Router();

router.get('/', controller.getMe);
router.patch('/patient', controller.updatePatient);
router.patch('/record', controller.updateRecord);

router.get('/appointments', controller.listAppointments);
router.post('/appointments', controller.book);
router.patch('/appointments/:id', controller.updateAppointment);
router.post('/appointments/:id/cancel', controller.cancel);

router.post('/email/start', limiters.mail, controller.emailStart);
router.post('/email/confirm', limiters.credentials, controller.emailConfirm);

module.exports = router;
