const { Router } = require('express');
const ctrl       = require('./promotions.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { createUpload } = require('../../middlewares/upload.middleware');

const uploadImage = createUpload('flash_sales', [{ name: 'image', maxCount: 1 }]);

const router = Router();
router.use(authMiddleware);

router.get('/',        ctrl.index.bind(ctrl));
router.get('/:id',     ctrl.show.bind(ctrl));
router.post('/',       uploadImage, ctrl.create.bind(ctrl));
router.put('/:id',     uploadImage, ctrl.update.bind(ctrl));
router.delete('/:id',  ctrl.remove.bind(ctrl));

module.exports = router;
