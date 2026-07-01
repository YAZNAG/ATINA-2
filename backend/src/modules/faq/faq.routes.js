const { Router } = require('express');
const ctrl       = require('./faq.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

// Catégories
router.get('/categories',        ctrl.indexCategories.bind(ctrl));
router.post('/categories',       ctrl.storeCategory.bind(ctrl));
router.put('/categories/:id',    ctrl.updateCategory.bind(ctrl));
router.delete('/categories/:id', ctrl.destroyCategory.bind(ctrl));

// Questions
router.get('/items',        ctrl.indexItems.bind(ctrl));
router.get('/items/:id',    ctrl.showItem.bind(ctrl));
router.post('/items',       ctrl.storeItem.bind(ctrl));
router.put('/items/:id',    ctrl.updateItem.bind(ctrl));
router.delete('/items/:id', ctrl.destroyItem.bind(ctrl));

module.exports = router;