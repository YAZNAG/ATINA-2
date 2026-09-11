const svc  = require('./customer_pack.service');
const resp = require('../../utils/response');
const { resolveCatalogNode } = require('../customer_catalog/customer_node');

const E = (res, next, e) => { if (e.statusCode) return resp.error(res, e.message, e.statusCode); next(e); };

// Node du client (packs rattachés à un node) — ?node_id=, sinon adresse / ville du client.
const ctxOf = async (req) => ({ node: await resolveCatalogNode(req) });

class CustomerPackController {
  async list(req, res, next) {
    try { resp.success(res, await svc.listActivePacks(await ctxOf(req))); }
    catch (e) { E(res, next, e); }
  }

  async show(req, res, next) {
    try { resp.success(res, await svc.getPackById(req.params.id)); }
    catch (e) { E(res, next, e); }
  }

  async similar(req, res, next) {
    try {
      resp.success(res, await svc.listSimilarPacks(req.params.id, req.query.limit, await ctxOf(req)));
    } catch (e) { E(res, next, e); }
  }
}

module.exports = new CustomerPackController();
