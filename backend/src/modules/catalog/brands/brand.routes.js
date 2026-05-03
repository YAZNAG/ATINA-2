const path = require('path');
const multer = require('multer');
const { Router } = require('express');
const ctrl = require('./brand.controller');
const auth = require('../../../middlewares/auth.middleware');
const perm = require('../../../middlewares/permission.middleware');
const { createValidator, updateValidator } = require('./brand.validator');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXT.includes(ext)) cb(null, true);
    else cb(new Error('Format non autorisé. Utilisez jpg, jpeg, png, webp.'), false);
  },
}).fields([{ name: 'logo', maxCount: 1 }]);

const router = Router();
router.use(auth);

router.get('/', perm('brands.view'), ctrl.index.bind(ctrl));
router.post('/', perm('brands.create'), upload, createValidator, ctrl.store.bind(ctrl));
router.get('/:id', perm('brands.view'), ctrl.show.bind(ctrl));
router.put('/:id', perm('brands.update'), upload, updateValidator, ctrl.update.bind(ctrl));
router.delete('/:id', perm('brands.delete'), ctrl.destroy.bind(ctrl));

module.exports = router;
