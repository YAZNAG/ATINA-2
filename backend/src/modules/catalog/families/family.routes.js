const { Router } = require('express');
const ctrl = require('./family.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createUpload } = require('../../../middlewares/upload.middleware');
const { createValidator, updateValidator } = require('./family.validator');

const router = Router();
router.use(auth);

const upload = createUpload('families', [
  { name: 'image', maxCount: 1 },
  { name: 'icon', maxCount: 1 },
]);

router.get('/', perm('families.view'), ctrl.index.bind(ctrl));
router.post('/', perm('families.create'), upload, createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('families.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('families.update'), upload, updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('families.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
