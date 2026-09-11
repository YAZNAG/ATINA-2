const { Router } = require('express');
const ctrl = require('./city.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator, moveValidator } = require('./city.validator');

const router = Router();
router.use(auth);

router.get('/', perm('cities.view'), ctrl.index.bind(ctrl));
router.post('/', perm('cities.create'), createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('cities.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('cities.update'), updateValidator, ctrl.update.bind(ctrl));
// Rattacher / déplacer une ville vers une autre région
router.patch('/:id/region', perm('cities.update'), moveValidator, ctrl.move.bind(ctrl));
router.delete('/:id', perm('cities.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
