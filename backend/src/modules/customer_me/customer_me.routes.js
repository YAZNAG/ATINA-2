const { Router }  = require('express');
const auth = require('../../middlewares/customer_auth.middleware');
const ctrl = require('./customer_me.controller');
const { createUpload } = require('../../middlewares/upload.middleware');

const uploadAvatar = createUpload('avatars', [{ name: 'avatar', maxCount: 1 }]);

const router = Router();
router.use(auth); 

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
router.get('/notifications',                 ctrl.listNotifications.bind(ctrl));
router.patch('/notifications/:id/read',      ctrl.markRead.bind(ctrl));
router.patch('/notifications/read-all',      ctrl.markAllRead.bind(ctrl));
router.delete('/notifications/all',          ctrl.deleteAllNotifications.bind(ctrl));
router.delete('/notifications/:id',          ctrl.deleteNotification.bind(ctrl));

router.put('/email',               ctrl.updateEmail.bind(ctrl));
router.post('/phone/request-otp',  ctrl.requestPhoneChange.bind(ctrl));
router.post('/phone/verify-otp',   ctrl.confirmPhoneChange.bind(ctrl));
router.put('/password',            ctrl.changePassword.bind(ctrl));

// Avatar
router.post('/avatar',   uploadAvatar, ctrl.uploadAvatar.bind(ctrl));
router.delete('/avatar',              ctrl.removeAvatar.bind(ctrl));

// Favorites
router.get('/favorites',                 ctrl.listFavorites.bind(ctrl));
router.post('/favorites',                ctrl.addFavorite.bind(ctrl));
router.delete('/favorites/:articleId',   ctrl.removeFavorite.bind(ctrl));

module.exports = router;
