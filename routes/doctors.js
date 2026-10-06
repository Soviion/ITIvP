const express = require('express');
const controller = require('../controllers/doctorsController');
const auth = require('../middleware/auth');

const router = express.Router();

// Справочник врачей открыт для всех
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Изменять данные врачей может только авторизованный пользователь
router.post('/', auth, controller.create);
router.put('/:id', auth, controller.update);
router.patch('/:id', auth, controller.patch);
router.delete('/:id', auth, controller.remove);

module.exports = router;
