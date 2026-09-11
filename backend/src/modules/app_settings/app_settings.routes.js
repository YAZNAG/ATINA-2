const { Router } = require('express');
const ctrl = require('./app_settings.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

/**
 * Admin / Configuration > App Configs & Méthodes de paiement — monté sur /admin/settings.
 * Lecture : app_configs.view — Écriture : app_configs.manage (toute modification est auditée).
 */
const router = Router();
router.use(auth);

// Paramètres applicatifs (clés GLOBALES : node_id IS NULL)
router.get('/configs', perm('app_configs.view'), ctrl.configs.bind(ctrl));
router.get('/configs/value-types', perm('app_configs.view'), ctrl.valueTypes.bind(ctrl));
router.post('/configs', perm('app_configs.manage'), ctrl.createConfig.bind(ctrl));
router.put('/configs/:id', perm('app_configs.manage'), ctrl.updateConfig.bind(ctrl));

// Méthodes de paiement
router.get('/payment-methods', perm('app_configs.view'), ctrl.paymentMethods.bind(ctrl));
router.post('/payment-methods', perm('app_configs.manage'), ctrl.createPaymentMethod.bind(ctrl));
router.put('/payment-methods/:id', perm('app_configs.manage'), ctrl.updatePaymentMethod.bind(ctrl));
router.patch('/payment-methods/:id/toggle-active', perm('app_configs.manage'), ctrl.togglePaymentMethod.bind(ctrl));

// Lookups (référentiels enum) — édition via l'éditeur générique /p0/tables/<table>
router.get('/lookups', perm('app_configs.view'), ctrl.lookups.bind(ctrl));

module.exports = router;
