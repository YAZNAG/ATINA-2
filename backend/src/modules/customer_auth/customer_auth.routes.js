const { Router } = require('express');
const ctrl = require('./customer_auth.controller');

const router = Router();

router.post('/check-phone',  ctrl.checkPhone.bind(ctrl));
router.post('/request-otp',  ctrl.requestOtp.bind(ctrl));
router.post('/verify-otp',   ctrl.verifyOtp.bind(ctrl));
router.post('/register',     ctrl.register.bind(ctrl));
router.post('/login',        ctrl.login.bind(ctrl));
router.get('/me',            ctrl.me.bind(ctrl));
router.post('/forgot-password', ctrl.forgotPassword.bind(ctrl));
router.post('/reset-password',  ctrl.resetPassword.bind(ctrl));

module.exports = router;
