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

// Paramètres applicatifs — liste de clés FERMÉE : édition de la valeur seulement (WF #41)
router.get('/configs', perm('app_configs.view'), ctrl.configs.bind(ctrl));
router.get('/configs/value-types', perm('app_configs.view'), ctrl.valueTypes.bind(ctrl));
router.put('/configs/:id', perm('app_configs.manage'), ctrl.updateConfig.bind(ctrl));

// Méthodes de paiement par node (WF #42) + synthèse méthodes × nodes (lecture seule)
router.get('/nodes/:node_id/payment-methods', perm('app_configs.view'), ctrl.nodePaymentMethods.bind(ctrl));
router.patch('/nodes/:node_id/payment-methods/:method_id', perm('app_configs.manage'), ctrl.setNodePaymentMethod.bind(ctrl));
router.get('/payment-methods/matrix', perm('app_configs.view'), ctrl.paymentMatrix.bind(ctrl));

// Catalogue des méthodes de paiement (référentiel)
router.get('/payment-methods', perm('app_configs.view'), ctrl.paymentMethods.bind(ctrl));
router.post('/payment-methods', perm('app_configs.manage'), ctrl.createPaymentMethod.bind(ctrl));
router.put('/payment-methods/:id', perm('app_configs.manage'), ctrl.updatePaymentMethod.bind(ctrl));
router.patch('/payment-methods/:id/toggle-active', perm('app_configs.manage'), ctrl.togglePaymentMethod.bind(ctrl));

// Lookups (référentiels enum) — édition via l'éditeur générique /p0/tables/<table>
router.get('/lookups', perm('app_configs.view'), ctrl.lookups.bind(ctrl));

module.exports = router;
