const { Router } = require('express');
const ctrl = require('./reorder_rule.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

// Specific named paths before /:id
router.get('/by-node/:node_id',  perm('stock.view'),   ctrl.byNode.bind(ctrl));
router.get('/refs',              perm('stock.view'),   ctrl.refs.bind(ctrl));
router.get('/suggested-qty',     perm('stock.view'),   ctrl.suggestedQty.bind(ctrl));
router.get('/',                  perm('stock.view'),   ctrl.list.bind(ctrl));
router.get('/:id',               perm('stock.view'),   ctrl.getById.bind(ctrl));

router.post('/bulk-save',        perm('stock.manage'), ctrl.bulkSave.bind(ctrl));
router.post('/should-reorder',   perm('stock.view'),   ctrl.shouldReorder.bind(ctrl));
router.post('/detect-critical',  perm('stock.view'),   ctrl.detectCritical.bind(ctrl));
router.post('/detect-overstock', perm('stock.view'),   ctrl.detectOverstock.bind(ctrl));
router.post('/',                 perm('stock.manage'), ctrl.create.bind(ctrl));

router.put('/:id',               perm('stock.manage'), ctrl.update.bind(ctrl));
router.delete('/:id',            perm('stock.manage'), ctrl.remove.bind(ctrl));

module.exports = router;
