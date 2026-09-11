const { Router } = require('express');
const ctrl = require('./promotions.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const { createUpload } = require('../../middlewares/upload.middleware');

const uploadImage = createUpload('flash_sales', [{ name: 'image', maxCount: 1 }]);

// flash_sales.view / flash_sales.manage (+ promotions.* et dashboard.view : accès historique conservé)
const canView   = perm.permAny(['flash_sales.view', 'flash_sales.manage', 'promotions.view', 'dashboard.view']);
const canManage = perm.permAny(['flash_sales.manage', 'promotions.create', 'promotions.update', 'promotions.delete', 'dashboard.view']);

const router = Router();
router.use(auth);

// Aides au formulaire « Configuration flash sale » (avant /:id)
router.get('/flash/lookups',        canView,   ctrl.lookups.bind(ctrl));
router.get('/flash/ceiling',        canView,   ctrl.ceiling.bind(ctrl));

router.get('/',                     canView,   ctrl.index.bind(ctrl));
router.get('/:id',                  canView,   ctrl.show.bind(ctrl));
router.get('/:id/deletion-check',   canView,   ctrl.deletionCheck.bind(ctrl));
router.post('/',                    canManage, uploadImage, ctrl.create.bind(ctrl));
router.put('/:id',                  canManage, uploadImage, ctrl.update.bind(ctrl));
router.patch('/:id/status',         canManage, ctrl.setStatus.bind(ctrl));
router.delete('/:id',               canManage, ctrl.remove.bind(ctrl));

module.exports = router;
