const { Router } = require('express');
const ctrl = require('./customer_faq.controller');

const router = Router();

router.get('/', ctrl.list.bind(ctrl));

module.exports = router;