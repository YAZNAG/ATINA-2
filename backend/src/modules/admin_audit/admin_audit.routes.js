const { Router } = require('express');
const ctrl = require('./admin_audit.controller');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');

/**
 * Admin / Configuration > Log & Audit — monté sur /admin/audit.
 * Tables append-only : LECTURE SEULE (aucune route d'écriture).
 */
const router = Router();
router.use(auth);

// Journal d'audit (audit_logs)
router.get('/logs', perm('audit_logs.view'), ctrl.logs.bind(ctrl));
router.get('/logs/facets', perm('audit_logs.view'), ctrl.logFacets.bind(ctrl));
router.get('/logs/export', perm('audit_logs.view'), ctrl.exportLogs.bind(ctrl));
router.get('/logs/:id', perm('audit_logs.view'), ctrl.logDetail.bind(ctrl));

// Notifications (log) — table notifications
router.get('/notifications', perm('notifications.view'), ctrl.notifications.bind(ctrl));
router.get('/notifications/facets', perm('notifications.view'), ctrl.notificationFacets.bind(ctrl));
router.get('/notifications/export', perm('notifications.view'), ctrl.exportNotifications.bind(ctrl));

module.exports = router;
