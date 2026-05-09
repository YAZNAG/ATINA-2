const { Router } = require('express');
const ctrl = require('./selling_rule.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

// Specific paths before /:id
router.get('/by-node/:node_id',       perm('stock.view'),   ctrl.byNode.bind(ctrl));
router.get('/estimated-delivery',     perm('stock.view'),   ctrl.estimatedDelivery.bind(ctrl));
router.get('/',                       perm('stock.view'),   ctrl.list.bind(ctrl));
router.get('/:id',                    perm('stock.view'),   ctrl.getById.bind(ctrl));

router.post('/bulk-save',             perm('stock.manage'), ctrl.bulkSave.bind(ctrl));
router.post('/can-sell',              perm('stock.view'),   ctrl.canSell.bind(ctrl));
router.post('/reserve-backorder',     perm('stock.manage'), ctrl.reserveBackorder.bind(ctrl));
router.post('/release-backorder',     perm('stock.manage'), ctrl.releaseBackorder.bind(ctrl));
router.post('/',                      perm('stock.manage'), ctrl.upsert.bind(ctrl));
router.put('/:id',                    perm('stock.manage'), ctrl.update.bind(ctrl));
router.delete('/:id',                 perm('stock.manage'), ctrl.remove.bind(ctrl));

module.exports = router;
