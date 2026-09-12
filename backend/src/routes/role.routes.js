const { Router } = require('express');
const roleController = require('../controllers/role.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const permissionMiddleware = require('../middlewares/permission.middleware');
const { createRoleValidator, updateRoleValidator } = require('../validators/role.validator');

const router = Router();

router.use(authMiddleware);

router.get('/', permissionMiddleware('roles.view'), roleController.getAll.bind(roleController));
router.post('/', permissionMiddleware('roles.create'), createRoleValidator, roleController.create.bind(roleController));
router.get('/:id', permissionMiddleware('roles.view'), roleController.getById.bind(roleController));
router.put('/:id', permissionMiddleware('roles.update'), updateRoleValidator, roleController.update.bind(roleController));
// US-003 : activer / désactiver un rôle (un rôle inactif n'est plus assignable)
router.patch('/:id/activate', permissionMiddleware('roles.update'), roleController.activate.bind(roleController));
router.patch('/:id/deactivate', permissionMiddleware('roles.update'), roleController.deactivate.bind(roleController));
// US-121 : dupliquer un rôle avec sa carte de permissions
router.post('/:id/duplicate', permissionMiddleware('roles.create'), roleController.duplicate.bind(roleController));
router.delete('/:id', permissionMiddleware('roles.delete'), roleController.delete.bind(roleController));
router.post('/:id/permissions', permissionMiddleware('permissions.assign'), roleController.assignPermissions.bind(roleController));
router.get('/:id/permissions', permissionMiddleware('permissions.view'), roleController.getPermissions.bind(roleController));

module.exports = router;
