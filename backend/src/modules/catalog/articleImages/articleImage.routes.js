const { Router } = require('express');
const ctrl = require('./articleImage.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createUpload } = require('../../../middlewares/upload.middleware');

const router = Router({ mergeParams: true });
router.use(auth);

const upload = createUpload('articles', [{ name: 'images', maxCount: 10 }]);

router.get('/', perm('articles.view'), ctrl.index.bind(ctrl));
router.post('/', perm('article_images.manage'), upload, ctrl.addImages.bind(ctrl));
router.patch('/:imageId/main', perm('article_images.manage'), ctrl.setMain.bind(ctrl));
router.patch('/:imageId/sort', perm('article_images.manage'), ctrl.updateSort.bind(ctrl));
router.delete('/:imageId', perm('article_images.manage'), ctrl.destroy.bind(ctrl));

module.exports = router;
