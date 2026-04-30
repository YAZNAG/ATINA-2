const { Router } = require('express');
const ctrl = require('./deliverySlot.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./deliverySlot.validator');

const router = Router();
router.use(auth);

router.get('/nodes/:id/slots', perm('delivery_slots.view'), ctrl.listByNode.bind(ctrl));
router.post('/nodes/:id/slots', perm('delivery_slots.create'), createValidator, ctrl.storeByNode.bind(ctrl));
router.put('/slots/:id', perm('delivery_slots.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/slots/:id', perm('delivery_slots.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
