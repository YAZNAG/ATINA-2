const { Router } = require('express');
const ctrl = require('./deliverySlot.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const {
  createValidator,
  updateValidator,
  dateQueryValidator,
  monthQueryValidator,
} = require('./deliverySlot.validator');

const router = Router();
router.use(auth);

router.get('/nodes/:id/slots', perm('delivery_slots.view'), dateQueryValidator, ctrl.byDate.bind(ctrl));
router.get('/nodes/:id/slots/calendar', perm('delivery_slots.view'), monthQueryValidator, ctrl.monthOverview.bind(ctrl));
router.post('/nodes/:id/slots', perm('delivery_slots.create'), createValidator, ctrl.store.bind(ctrl));
router.put('/slots/:id', perm('delivery_slots.update'), updateValidator, ctrl.update.bind(ctrl));
router.delete('/slots/:id', perm('delivery_slots.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;