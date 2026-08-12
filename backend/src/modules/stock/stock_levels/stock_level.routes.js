const { Router } = require('express');
const ctrl = require('./stock_level.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

// GET — specific paths must come before /:id
router.get('/',                 perm('stock.view'),   ctrl.list.bind(ctrl));
router.get('/by-node/:node_id', perm('stock.view'),   ctrl.byNode.bind(ctrl));
router.get('/:id',              perm('stock.view'),   ctrl.getById.bind(ctrl));

// POST mutations
router.post('/receipt',         perm('stock.manage'), ctrl.receipt.bind(ctrl));
router.post('/reserve',         perm('stock.manage'), ctrl.reserve.bind(ctrl));
router.post('/picking',         perm('stock.manage'), ctrl.picking.bind(ctrl));
router.post('/cancel',          perm('stock.manage'), ctrl.cancel.bind(ctrl));
router.post('/incoming',        perm('stock.manage'), ctrl.incoming.bind(ctrl));
router.post('/cod-delivered',   perm('stock.manage'), ctrl.codDelivered.bind(ctrl));
router.post('/cod-collected',   perm('stock.manage'), ctrl.codCollected.bind(ctrl));
router.post('/count',           perm('stock.manage'), ctrl.count.bind(ctrl));
router.post('/adjust',          perm('stock.manage'), ctrl.adjust.bind(ctrl));
router.post('/recalculate',     perm('stock.manage'), ctrl.recalculate.bind(ctrl));
router.post('/move',            perm('stock.manage'), ctrl.applyMove.bind(ctrl));
router.get('/',                 perm('stock.view'),   ctrl.list.bind(ctrl));
router.get('/by-node/:node_id', perm('stock.view'),   ctrl.byNode.bind(ctrl));
router.get('/by-sku/:sku_id',   perm('stock.view'),   ctrl.bySku.bind(ctrl));
router.get('/:id',              perm('stock.view'),   ctrl.getById.bind(ctrl));
module.exports = router;
