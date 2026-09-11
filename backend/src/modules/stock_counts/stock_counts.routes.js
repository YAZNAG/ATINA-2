const { Router } = require('express');
const ctrl = require('./stock_counts.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

// Comptage / Inventaire physique — monté sur /stock-counts (WF#5, US-043, US-044)
const router = Router();
router.use(auth);

router.get('/refs',          perm.permAny(['stock_counts.view', 'stock_counts.manage']), ctrl.refs.bind(ctrl));
router.get('/',              perm.permAny(['stock_counts.view', 'stock_counts.manage']), ctrl.index.bind(ctrl));
router.get('/:id',           perm.permAny(['stock_counts.view', 'stock_counts.manage']), ctrl.show.bind(ctrl));

router.post('/',             perm('stock_counts.manage'), ctrl.store.bind(ctrl));
router.put('/:id/lines',     perm('stock_counts.manage'), ctrl.saveLines.bind(ctrl));
router.post('/:id/validate', perm('stock_counts.manage'), ctrl.validate.bind(ctrl));
router.post('/:id/cancel',   perm('stock_counts.manage'), ctrl.cancel.bind(ctrl));

module.exports = router;
