const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { loginValidator } = require('../validators/auth.validator');

const router = Router();

router.post('/login', loginValidator, authController.login.bind(authController));
router.get('/me', authMiddleware, authController.me.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));

module.exports = router;
