const { Router }     = require('express');
const ctrl           = require('./support.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

router.get('/',                             ctrl.index.bind(ctrl));
router.get('/:id',                          ctrl.show.bind(ctrl));
router.put('/:id/assign',    ctrl.assign.bind(ctrl));
router.patch('/:id/assign',  ctrl.assign.bind(ctrl));
router.put('/:id/status',    ctrl.updateStatus.bind(ctrl));
router.patch('/:id/status',  ctrl.updateStatus.bind(ctrl));
router.post('/:id/messages', ctrl.storeMessage.bind(ctrl));

module.exports = router;
