const path = require('path');
const multer = require('multer');
const { Router } = require('express');
const ctrl = require('./family.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./family.validator');

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
  { name: 'icon', maxCount: 1 },
]);

const router = Router();
router.use(auth);

router.get('/', perm('families.view'), ctrl.index.bind(ctrl));
router.post('/', perm('families.create'), upload, createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('families.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('families.update'), upload, updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('families.delete'), ctrl.destroy.bind(ctrl));
router.patch('/:id/restore', perm('families.delete'), ctrl.restore.bind(ctrl));

module.exports = router;
