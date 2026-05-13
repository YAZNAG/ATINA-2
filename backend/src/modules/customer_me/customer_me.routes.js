const { Router }  = require('express');
const auth = require('../../middlewares/customer_auth.middleware');
const ctrl = require('./customer_me.controller');

const router = Router();
router.use(auth); // All routes require customer JWT

// Profile
router.get('/',    ctrl.getProfile.bind(ctrl));
router.put('/',    ctrl.updateProfile.bind(ctrl));

// Addresses
router.get('/addresses',                  ctrl.listAddresses.bind(ctrl));
router.post('/addresses',                 ctrl.createAddress.bind(ctrl));
router.put('/addresses/:id',              ctrl.updateAddress.bind(ctrl));
router.patch('/addresses/:id/set-default', ctrl.setDefaultAddress.bind(ctrl));
router.delete('/addresses/:id',           ctrl.deleteAddress.bind(ctrl));

module.exports = router;
