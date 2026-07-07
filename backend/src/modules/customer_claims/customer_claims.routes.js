const { Router } = require('express');
const ctrl         = require('./customer_claims.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/types',   ctrl.types.bind(ctrl));         
router.get('/',        ctrl.list.bind(ctrl));           
router.get('/:id',     ctrl.show.bind(ctrl));           
router.post('/',       ctrl.store.bind(ctrl));         
router.delete('/:id',  ctrl.cancel.bind(ctrl));        

module.exports = router;