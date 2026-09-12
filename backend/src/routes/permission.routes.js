const { Router } = require('express');
const permissionController = require('../controllers/permission.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const permissionMiddleware = require('../middlewares/permission.middleware');

const router = Router();

router.use(authMiddleware);

router.get('/', permissionMiddleware('permissions.view'), permissionController.getAll.bind(permissionController));
// Matrice du classeur : ressource (ligne) × read / write / delete / export (colonne)
router.get('/matrix', permissionMiddleware('permissions.view'), permissionController.matrix.bind(permissionController));

module.exports = router;
