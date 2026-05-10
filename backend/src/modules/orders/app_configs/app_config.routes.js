const { Router } = require('express');
const ctrl = require('./app_config.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

router.get('/keys',   perm('dashboard.view'), ctrl.keys.bind(ctrl));
router.get('/',       perm('dashboard.view'), ctrl.index.bind(ctrl));
router.post('/seed',  perm('dashboard.view'), ctrl.seedDefaults.bind(ctrl));
router.post('/',      perm('dashboard.view'), ctrl.save.bind(ctrl));
router.delete('/:id', perm('dashboard.view'), ctrl.destroy.bind(ctrl));

module.exports = router;
