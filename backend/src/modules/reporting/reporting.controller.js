const response = require('../../utils/response');
const legacy = require('./reporting.service');
const overview = require('./overview.service');
const distribution = require('./distribution.service');

/** Contrôleur Reporting / Supervision — lecture seule. */
class ReportingController {
  // ── Référentiels de filtres ────────────────────────────────────────────────
  async filters(req, res, next) {
    try { response.success(res, await overview.filterOptions()); } catch (err) { next(err); }
  }

  // ── KPI Overview (écran d'accueil) ─────────────────────────────────────────
  async overview(req, res, next) {
    try { response.success(res, await overview.overview(req.query)); } catch (err) { next(err); }
  }

  async overviewOrders(req, res, next) {
    try { response.success(res, await overview.ordersTab(req.query)); } catch (err) { next(err); }
  }

  async overviewStock(req, res, next) {
    try {
      const { data, pagination, meta } = await overview.stockTab(req.query);
      res.json({ success: true, message: 'Success', data, pagination, meta });
    } catch (err) { next(err); }
  }

  async overviewPreparation(req, res, next) {
    try { response.success(res, await overview.preparationTab(req.query)); } catch (err) { next(err); }
  }

  // ── Distribution Stock ─────────────────────────────────────────────────────
  async coverageByNode(req, res, next) {
    try { response.success(res, await distribution.nodeCoverage(req.query)); } catch (err) { next(err); }
  }

  async coverageBySku(req, res, next) {
    try {
      const { data, pagination, meta } = await distribution.skuCoverage(req.query);
      res.json({ success: true, message: 'Success', data, pagination, meta });
    } catch (err) { next(err); }
  }

  async stockAlerts(req, res, next) {
    try {
      const { data, pagination, meta } = await distribution.alerts(req.query);
      res.json({ success: true, message: 'Success', data, pagination, meta });
    } catch (err) { next(err); }
  }

  async stockMatrix(req, res, next) {
    try { response.success(res, await distribution.matrix(req.query)); } catch (err) { next(err); }
  }

  async stockDetail(req, res, next) {
    try { response.success(res, await distribution.detail(req.query)); } catch (err) { next(err); }
  }

  // ── Endpoints historiques (conservés) ──────────────────────────────────────
  async dashboard(req, res, next) {
    try { response.success(res, await legacy.dashboardSummary(req.query)); } catch (err) { next(err); }
  }

  async orders(req, res, next) {
    try { response.success(res, await legacy.orderKpis(req.query)); } catch (err) { next(err); }
  }

  async picking(req, res, next) {
    try { response.success(res, await legacy.pickingKpis(req.query)); } catch (err) { next(err); }
  }

  async delivery(req, res, next) {
    try { response.success(res, await legacy.deliveryKpis(req.query)); } catch (err) { next(err); }
  }

  async stock(req, res, next) {
    try { response.success(res, await legacy.stockKpis(req.query)); } catch (err) { next(err); }
  }

  async payments(req, res, next) {
    try { response.success(res, await legacy.paymentKpis(req.query)); } catch (err) { next(err); }
  }
}

module.exports = new ReportingController();
