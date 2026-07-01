const { Router }   = require('express');
const ctrl         = require('./customer_cart.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/',                ctrl.getCart.bind(ctrl));
router.post('/',               ctrl.addItem.bind(ctrl));
router.post('/pack',           ctrl.addPack.bind(ctrl));
router.put('/pack/:pack_id',   ctrl.updatePackQuantity.bind(ctrl));
router.delete('/pack/:pack_id',ctrl.removePack.bind(ctrl));
router.put('/:item_id',        ctrl.updateItem.bind(ctrl));
router.delete('/',             ctrl.clearCart.bind(ctrl));
router.delete('/:item_id',     ctrl.removeItem.bind(ctrl));

module.exports = router;
