const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const catalogRoutes = require('../modules/catalog/catalog.routes');
const locationRoutes = require('../modules/location/location.routes');
const nodeRoutes = require('../modules/node/node.routes');
const p0Routes = require('../modules/p0/p0.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const warehouseRoutes = require('../modules/warehouse/warehouse.routes');
const stockRoutes = require('../modules/stock/stock.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/catalog', catalogRoutes);
router.use('/', locationRoutes);
router.use('/', nodeRoutes);
router.use('/p0', p0Routes);
router.use('/customers', customersRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/stock', stockRoutes);

module.exports = router;
