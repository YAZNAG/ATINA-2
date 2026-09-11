const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const permissionMiddleware = require('../middlewares/permission.middleware');
const { createUserValidator, updateUserValidator, assignRoleValidator } = require('../validators/user.validator');

const router = Router();

router.use(authMiddleware);

// Comptes Back-Office (US-004 / US-005 / US-006)
router.get('/', permissionMiddleware('users.view'), userController.getAll.bind(userController));
router.post('/', permissionMiddleware('users.create'), createUserValidator, userController.create.bind(userController));
router.get('/:id', permissionMiddleware('users.view'), userController.getById.bind(userController));
router.put('/:id', permissionMiddleware('users.update'), updateUserValidator, userController.update.bind(userController));
router.patch('/:id/role', permissionMiddleware('users.update'), assignRoleValidator, userController.assignRole.bind(userController));
router.patch('/:id/activate', permissionMiddleware('users.update'), userController.activate.bind(userController));
router.patch('/:id/deactivate', permissionMiddleware('users.update'), userController.deactivate.bind(userController));
router.patch('/:id/restore', permissionMiddleware('users.delete'), userController.restore.bind(userController));
// Suppression = soft-delete (is_deleted + deleted_at)
router.delete('/:id', permissionMiddleware('users.delete'), userController.delete.bind(userController));

module.exports = router;
