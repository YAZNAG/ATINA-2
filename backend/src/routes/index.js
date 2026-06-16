const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const catalogRoutes = require('../modules/catalog/catalog.routes');
const locationRoutes = require('../modules/location/location.routes');
const nodeRoutes = require('../modules/node/node.routes');
const p0Routes = require('../modules/p0/p0.routes');
const customerRoutes = require('../modules/customers/customer.routes');
const warehouseRoutes = require('../modules/warehouse/warehouse.routes');
const stockRoutes    = require('../modules/stock/stock.routes');
const deliveryRoutes = require('../modules/delivery/delivery.routes');
const paymentRoutes  = require('../modules/payment/payment.routes');
const walletRoutes   = require('../modules/wallet/wallet.routes');
const ordersRoutes   = require('../modules/orders/orders.routes');
const { router: addressRouter } = require('../modules/addresses/address.routes');
const checkoutRoutes      = require('../modules/checkout/checkout.routes');
const customerAuthRoutes     = require('../modules/customer_auth/customer_auth.routes');
const customerCatalogRoutes  = require('../modules/customer_catalog/customer_catalog.routes');
const customerMeRoutes       = require('../modules/customer_me/customer_me.routes');
const customerCheckoutRoutes = require('../modules/customer_checkout/customer_checkout.routes');
const tourRoutes             = require('../modules/tours/tour.routes');
const reportingRoutes        = require('../modules/reporting/reporting.routes');
const pickupRoutes           = require('../modules/pickup/pickup.routes');
const deliveryMgmtRoutes     = require('../modules/delivery_mgmt/delivery.routes');
const driverPortalRoutes     = require('../modules/driver_portal/driverPortal.routes');
const ordersMgmtRoutes  = require('../modules/orders_mgmt/order_mgmt.routes');
const pickingRoutes       = require('../modules/picking/picking.routes');
const staffRoutes         = require('../modules/staff/staff.routes');
const pickerPortalRoutes  = require('../modules/picker_portal/pickerPortal.routes');


const customerCartRoutes = require('../modules/customer_cart/customer_cart.routes');

const router = Router();

// ── Routes publiques/propres — MUST come before wildcard mounts ('/') ─────────
// nodeRoutes / locationRoutes appliquent router.use(auth) qui intercepte TOUT
// via router.use('/') → ces routes doivent être montées AVANT.
router.use('/customer/auth',     customerAuthRoutes);
router.use('/customer/catalog',  customerCatalogRoutes);
router.use('/customer/me',       customerMeRoutes);
router.use('/customer/cart', customerCartRoutes);
router.use('/customer/checkout', customerCheckoutRoutes);
router.use('/picker',            pickerPortalRoutes);   // ← login public /picker/login
router.use('/driver',            driverPortalRoutes);   // ← login public /driver/login

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/catalog', catalogRoutes);
router.use('/', locationRoutes);
router.use('/', nodeRoutes);
router.use('/p0', p0Routes);
router.use('/customers', customerRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/stock',    stockRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/payment',  paymentRoutes);
router.use('/wallet',   walletRoutes);
router.use('/orders',    ordersRoutes);
router.use('/addresses', addressRouter);
router.use('/checkout',       checkoutRoutes);
router.use('/orders-mgmt', ordersMgmtRoutes);
router.use('/picking',     pickingRoutes);
router.use('/staff',       staffRoutes);
router.use('/tours',       tourRoutes);
router.use('/reporting',   reportingRoutes);
router.use('/pickup',      pickupRoutes);
router.use('/delivery',    deliveryMgmtRoutes);
router.use('/loyalty',     require('../modules/loyalty/loyalty.routes'));




module.exports = router;