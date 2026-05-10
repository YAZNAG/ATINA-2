const { Router } = require('express');
const ctrl = require('./address.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

const canView   = perm.permAny(['customers.view',   'dashboard.view']);
const canCreate = perm.permAny(['customers.create',  'dashboard.view']);
const canUpdate = perm.permAny(['customers.update',  'dashboard.view']);
const canDelete = perm.permAny(['customers.delete',  'dashboard.view']);

// Nested under /customers/:customer_id/addresses
const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(auth);
nestedRouter.get('/',    canView,   ctrl.listByCustomer.bind(ctrl));
nestedRouter.post('/',   canCreate, ctrl.store.bind(ctrl));

// Standalone /addresses/:id for update, patch, delete
const router = Router();
router.use(auth);
router.put('/:id',              canUpdate, ctrl.update.bind(ctrl));
router.patch('/:id/set-default', canUpdate, ctrl.setDefault.bind(ctrl));
router.delete('/:id',           canDelete, ctrl.destroy.bind(ctrl));

module.exports = { nestedRouter, router };
