const { Router } = require('express');
const ctrl = require('./brand.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createUpload } = require('../../../middlewares/upload.middleware');
const { createValidator, updateValidator } = require('./brand.validator');

const router = Router();
router.use(auth);

const upload = createUpload('brands', [{ name: 'logo', maxCount: 1 }]);

router.get('/', perm('brands.view'), ctrl.index.bind(ctrl));
router.post('/', perm('brands.create'), upload, createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('brands.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('brands.update'), upload, updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('brands.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
