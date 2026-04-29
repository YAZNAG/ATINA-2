const { Router } = require('express');
const ctrl = require('./articleImage.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createUpload } = require('../../../middlewares/upload.middleware');

const router = Router({ mergeParams: true });
router.use(auth);

const upload = createUpload('articles', [{ name: 'images', maxCount: 10 }]);

router.post('/', perm('article_images.manage'), upload, ctrl.addImages.bind(ctrl));
router.patch('/:imageId/main', perm('article_images.manage'), ctrl.setMain.bind(ctrl));
router.delete('/:imageId', perm('article_images.manage'), ctrl.destroy.bind(ctrl));

module.exports = router;
