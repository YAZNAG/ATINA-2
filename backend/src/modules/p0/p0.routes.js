const { Router } = require('express');
const ctrl = require('./p0.controller');
const crud = require('./p0.crud.controller');
const auth = require('../../middlewares/auth.middleware');
const permissionMiddleware = require('../../middlewares/permission.middleware');

const router = Router();
router.use(auth);

/** CRUD générique : dashboard pour la plupart des tables ; clients aussi avec `customers.view`. */
function canP0Crud(req, res, next) {
  const sql = String(req.params.sql || '').toLowerCase();
  if (sql === 'customers') {
    return permissionMiddleware.permAny(['dashboard.view', 'customers.view'])(req, res, next);
  }
  return permissionMiddleware.permAny(['dashboard.view'])(req, res, next);
}

router.get('/registry', ctrl.registry.bind(ctrl));
router.get('/table/:sql', ctrl.tableBySql.bind(ctrl));
router.get('/relations', ctrl.relations.bind(ctrl));
router.get('/relations/:sql', ctrl.relationsForTable.bind(ctrl));

router.get('/crud/refs/:sql/options', canP0Crud, crud.refOptions.bind(crud));
router.get('/crud/:sql/meta', canP0Crud, crud.meta.bind(crud));
router.get('/crud/:sql', canP0Crud, crud.list.bind(crud));
router.post('/crud/:sql', canP0Crud, crud.create.bind(crud));
router.get('/crud/:sql/:id', canP0Crud, crud.getOne.bind(crud));
router.put('/crud/:sql/:id', canP0Crud, crud.update.bind(crud));
router.delete('/crud/:sql/:id', canP0Crud, crud.remove.bind(crud));

module.exports = router;
