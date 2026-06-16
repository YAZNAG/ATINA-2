const { Router }  = require('express');
const auth = require('../../middlewares/customer_auth.middleware');
const ctrl = require('./customer_me.controller');

const router = Router();
router.use(auth); // All routes require customer JWT

// Profile
router.get('/',    ctrl.getProfile.bind(ctrl));
router.put('/',    ctrl.updateProfile.bind(ctrl));

// Addresses
router.get('/addresses',                   ctrl.listAddresses.bind(ctrl));
router.post('/addresses',                  ctrl.createAddress.bind(ctrl));
router.put('/addresses/:id',               ctrl.updateAddress.bind(ctrl));
router.patch('/addresses/:id/set-default', ctrl.setDefaultAddress.bind(ctrl));
router.delete('/addresses/:id',            ctrl.deleteAddress.bind(ctrl));

// Orders
router.get('/orders',     ctrl.listOrders.bind(ctrl));
router.get('/orders/:id', ctrl.getOrderById.bind(ctrl));

// Wallet
router.get('/wallet', ctrl.getWallet.bind(ctrl));

// Notifications
router.get('/notifications',              ctrl.listNotifications.bind(ctrl));
router.patch('/notifications/:id/read',   ctrl.markRead.bind(ctrl));
router.patch('/notifications/read-all',   ctrl.markAllRead.bind(ctrl));

router.put('/email',               ctrl.updateEmail.bind(ctrl));
router.post('/phone/request-otp',  ctrl.requestPhoneChange.bind(ctrl));
router.post('/phone/verify-otp',   ctrl.confirmPhoneChange.bind(ctrl));
router.put('/password',            ctrl.changePassword.bind(ctrl));

module.exports = router;
