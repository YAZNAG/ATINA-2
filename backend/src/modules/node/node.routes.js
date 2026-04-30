const { Router } = require('express');

const router = Router();

router.use('/node-types', require('./nodeTypes/nodeType.routes'));
router.use('/nodes', require('./nodes/node.routes'));
router.use('/', require('./deliverySlots/deliverySlot.routes'));

module.exports = router;
