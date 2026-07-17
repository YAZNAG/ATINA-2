const { Router } = require('express');
const ctrl       = require('./customer_pack.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/',    ctrl.list.bind(ctrl));
router.get('/:id/similar', ctrl.similar.bind(ctrl)); 
router.get('/:id', ctrl.show.bind(ctrl));

module.exports = router;