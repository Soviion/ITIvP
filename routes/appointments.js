const express = require('express');
const router = express.Router();
const {
  getAllAppointments,
  queryAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  patchAppointment,
  deleteAppointment,
} = require('../controllers/appointmentsController');

router.get('/', getAllAppointments);
router.query('/', queryAppointments);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.put('/:id', updateAppointment);
router.patch('/:id', patchAppointment);
router.delete('/:id', deleteAppointment);

module.exports = router;
