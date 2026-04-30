const { Router } = require('express');
const ctrl = require('./city.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./city.validator');

const router = Router();
router.use(auth);

router.get('/', perm('cities.view'), ctrl.index.bind(ctrl));
router.post('/', perm('cities.create'), createValidator, ctrl.store.bind(ctrl));
router.put('/:id', perm('cities.update'), updateValidator, ctrl.update.bind(ctrl));

module.exports = router;
