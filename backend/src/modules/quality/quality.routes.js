const { Router } = require('express');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const ctrl = require('./quality.controller');

// Monté sur /quality-checks (US-069 / US-070).
const router = Router();
router.use(auth);

const canView   = perm.permAny(['quality_checks.view', 'quality_checks.create']);
const canCreate = perm('quality_checks.create');

router.get('/',                 canView,   ctrl.index.bind(ctrl));
router.get('/export',           canView,   ctrl.exportRows.bind(ctrl));
router.get('/stats',            canView,   ctrl.stats.bind(ctrl));
router.get('/lookups',          canView,   ctrl.lookups.bind(ctrl));
router.get('/lookups/sessions', canView,   ctrl.sessionsLookup.bind(ctrl));
router.post('/',                canCreate, ctrl.store.bind(ctrl));
router.get('/:id',              canView,   ctrl.show.bind(ctrl));

module.exports = router;
