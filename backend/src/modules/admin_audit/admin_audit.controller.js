const service = require('./admin_audit.service');
const response = require('../../utils/response');
const { audit } = require('../../utils/audit');

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const sendCsv = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
};

class AdminAuditController {
  async logs(req, res, next) {
    try {
      const result = await service.listLogs(req.query);
      return res.json({ success: true, message: 'Success', ...result });
    } catch (err) { next(err); }
  }

  async logFacets(req, res, next) {
    try { return response.success(res, await service.logFacets()); } catch (err) { next(err); }
  }

  async logDetail(req, res, next) {
    try { return response.success(res, await service.getLog(req.params.id)); } catch (err) { next(err); }
  }

  async exportLogs(req, res, next) {
    try {
      const csv = await service.exportLogs(req.query);
      // L'export du journal est lui-même une action sensible : on la trace.
      await audit(req, { action: 'EXPORT', resource: 'audit_logs', new_values: { filters: req.query } });
      return sendCsv(res, `journal_audit_${stamp()}.csv`, csv);
    } catch (err) { next(err); }
  }

  async notifications(req, res, next) {
    try {
      const result = await service.listNotifications(req.query);
      return res.json({ success: true, message: 'Success', ...result });
    } catch (err) { next(err); }
  }

  async notificationFacets(req, res, next) {
    try { return response.success(res, await service.notificationFacets()); } catch (err) { next(err); }
  }

  async exportNotifications(req, res, next) {
    try {
      const csv = await service.exportNotifications(req.query);
      return sendCsv(res, `journal_notifications_${stamp()}.csv`, csv);
    } catch (err) { next(err); }
  }
}

module.exports = new AdminAuditController();
