const path = require('path');
const multer = require('multer');
const { Router } = require('express');
const ctrl = require('./category.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./category.validator');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXT.includes(ext)) cb(null, true);
    else cb(new Error('Format non autorisé. Utilisez jpg, jpeg, png, webp.'), false);
  },
}).fields([
  { name: 'image', maxCount: 1 },
]);

const router = Router();
router.use(auth);

router.get('/', perm('categories.view'), ctrl.index.bind(ctrl));
router.post('/', perm('categories.create'), upload, createValidator, ctrl.store.bind(ctrl));
router.patch('/reorder', perm('categories.update'), ctrl.reorder.bind(ctrl));
router.get('/:id', perm('categories.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('categories.update'), upload, updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('categories.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/toggle-status', perm('categories.update'), ctrl.toggleStatus.bind(ctrl));
router.patch('/:id/restore', perm('categories.delete'), ctrl.restore.bind(ctrl));

module.exports = router;