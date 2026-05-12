const { Router } = require('express');
const ctrl = require('./customer_auth.controller');

const router = Router();

router.post('/check-phone',  ctrl.checkPhone.bind(ctrl));
router.post('/request-otp',  ctrl.requestOtp.bind(ctrl));
router.post('/verify-otp',   ctrl.verifyOtp.bind(ctrl));

module.exports = router;
