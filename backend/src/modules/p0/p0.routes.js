const { Router } = require('express');
const ctrl = require('./p0.controller');
const crud = require('./p0.crud.controller');
const auth = require('../../middlewares/auth.middleware');
const permissionMiddleware = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

const canP0Crud = permissionMiddleware.permAny(['dashboard.view']);

router.get('/registry', ctrl.registry.bind(ctrl));
router.get('/table/:sql', ctrl.tableBySql.bind(ctrl));

router.get('/crud/:sql', canP0Crud, crud.list.bind(crud));
router.post('/crud/:sql', canP0Crud, crud.create.bind(crud));
router.get('/crud/:sql/:id', canP0Crud, crud.getOne.bind(crud));
router.put('/crud/:sql/:id', canP0Crud, crud.update.bind(crud));
router.delete('/crud/:sql/:id', canP0Crud, crud.remove.bind(crud));

module.exports = router;
