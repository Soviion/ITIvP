const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/auth');
const limiters = require('../middleware/rateLimit');

const router = express.Router();

router.use(limiters.general);

router.post('/register', limiters.mail, controller.register);
router.get('/verify-email', controller.verifyEmail);
router.post('/resend-verification', limiters.mail, controller.resendVerification);

router.post('/login', limiters.credentials, controller.login);
router.post('/login/2fa', limiters.credentials, controller.loginTwoFactor);

// Требуют авторизации
router.post('/change-password', auth, limiters.credentials, controller.changePassword);
router.post('/2fa/setup', auth, controller.twoFactorSetup);
router.get('/2fa/qr', auth, controller.twoFactorQr);
router.post('/2fa/enable', auth, controller.twoFactorEnable);
router.post('/2fa/disable', auth, limiters.credentials, controller.twoFactorDisable);

module.exports = router;
