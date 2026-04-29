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
router.delete('/:id', permissionMiddleware('roles.delete'), roleController.delete.bind(roleController));
router.post('/:id/permissions', permissionMiddleware('permissions.assign'), roleController.assignPermissions.bind(roleController));
router.get('/:id/permissions', permissionMiddleware('permissions.view'), roleController.getPermissions.bind(roleController));

module.exports = router;
