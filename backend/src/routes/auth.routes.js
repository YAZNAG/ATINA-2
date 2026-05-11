const { Router }       = require('express');
const authController   = require('../controllers/auth.controller');
const authMiddleware   = require('../middlewares/auth.middleware');
const { loginValidator } = require('../validators/auth.validator');
const staffAuthController = require('../modules/staff/staff.auth.controller');

const router = Router();

// Back-office auth
router.post('/login',  loginValidator, authController.login.bind(authController));
router.get('/me',      authMiddleware, authController.me.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));

// Picker / Driver auth (phone + password)
router.post('/picker/login', staffAuthController.pickerLogin.bind(staffAuthController));
router.post('/driver/login', staffAuthController.driverLogin.bind(staffAuthController));

module.exports = router;
