const { Router } = require('express');
const authMiddleware = require('../../middlewares/auth.middleware');
const permissionMiddleware = require('../../middlewares/permission.middleware');
const ctrl = require('./customers.controller');

const router = Router();

router.use(authMiddleware);
const canViewCustomers = permissionMiddleware.permAny(['customers.view', 'dashboard.view']);
router.get('/', canViewCustomers, ctrl.list.bind(ctrl));
router.get('/:id', canViewCustomers, ctrl.getById.bind(ctrl));

module.exports = router;
