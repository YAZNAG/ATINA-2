const { Router }            = require('express');
const ctrl                  = require('./customer_support.controller');
const customerAuthMiddleware = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuthMiddleware);

router.get('/',                  ctrl.index.bind(ctrl));
router.post('/',                 ctrl.store.bind(ctrl));
router.get('/:id',               ctrl.show.bind(ctrl));
router.post('/:id/messages',     ctrl.storeMessage.bind(ctrl));
router.delete('/:id',            ctrl.destroy.bind(ctrl));

module.exports = router;
