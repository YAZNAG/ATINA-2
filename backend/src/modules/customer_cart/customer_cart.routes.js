const { Router }   = require('express');
const ctrl         = require('./customer_cart.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/',           ctrl.getCart.bind(ctrl));
router.post('/',          ctrl.addItem.bind(ctrl));
router.put('/:sku_id',    ctrl.updateItem.bind(ctrl));
router.delete('/',        ctrl.clearCart.bind(ctrl));  
router.delete('/:sku_id', ctrl.removeItem.bind(ctrl));   

module.exports = router;