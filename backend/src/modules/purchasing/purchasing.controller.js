const service = require('./purchasing.service');
const response = require('../../utils/response');

const paged = (res, result) => res.json({ success: true, message: 'Success', data: result.data, pagination: result.pagination });

class PurchasingController {
  // ─── Référentiels ──────────────────────────────────────────────────────────
  async lookups(req, res, next) {
    try { return response.success(res, await service.lookups()); } catch (err) { next(err); }
  }

  async searchSkus(req, res, next) {
    try { return response.success(res, await service.searchSkus(req.query)); } catch (err) { next(err); }
  }

  // ─── Fournisseurs ──────────────────────────────────────────────────────────
  async suppliersIndex(req, res, next) {
    try { return paged(res, await service.suppliers.list(req.query)); } catch (err) { next(err); }
  }

  async suppliersShow(req, res, next) {
    try { return response.success(res, await service.suppliers.getById(req.params.id)); } catch (err) { next(err); }
  }

  async suppliersStore(req, res, next) {
    try { return response.success(res, await service.suppliers.create(req.body, req), 'Fournisseur créé', 201); } catch (err) { next(err); }
  }

  async suppliersUpdate(req, res, next) {
    try { return response.success(res, await service.suppliers.update(req.params.id, req.body, req), 'Fournisseur mis à jour'); } catch (err) { next(err); }
  }

  async suppliersToggle(req, res, next) {
    try {
      const s = await service.suppliers.toggleStatus(req.params.id, req);
      return response.success(res, s, s.is_active ? 'Fournisseur activé' : 'Fournisseur désactivé');
    } catch (err) { next(err); }
  }

  async suppliersDestroy(req, res, next) {
    try { return response.success(res, await service.suppliers.remove(req.params.id, req), 'Fournisseur supprimé'); } catch (err) { next(err); }
  }

  async suppliersRestore(req, res, next) {
    try { return response.success(res, await service.suppliers.restore(req.params.id, req), 'Fournisseur restauré'); } catch (err) { next(err); }
  }

  // ─── Prix fournisseurs ─────────────────────────────────────────────────────
  async pricesIndex(req, res, next) {
    try { return paged(res, await service.prices.list(req.query)); } catch (err) { next(err); }
  }

  async pricesBest(req, res, next) {
    try { return response.success(res, await service.prices.best(req.query)); } catch (err) { next(err); }
  }

  async pricesShow(req, res, next) {
    try { return response.success(res, await service.prices.getById(req.params.id)); } catch (err) { next(err); }
  }

  async pricesStore(req, res, next) {
    try { return response.success(res, await service.prices.create(req.body, req), 'Prix fournisseur enregistré', 201); } catch (err) { next(err); }
  }

  async pricesRenegotiate(req, res, next) {
    try { return response.success(res, await service.prices.renegotiate(req.params.id, req.body, req), 'Nouveau prix enregistré (renégociation)', 201); } catch (err) { next(err); }
  }

  async pricesUpdate(req, res, next) {
    try { return response.success(res, await service.prices.update(req.params.id, req.body, req), 'Prix fournisseur mis à jour'); } catch (err) { next(err); }
  }

  async pricesDestroy(req, res, next) {
    try { return response.success(res, await service.prices.remove(req.params.id, req), 'Prix fournisseur désactivé'); } catch (err) { next(err); }
  }

  // ─── Bons de commande ──────────────────────────────────────────────────────
  async ordersIndex(req, res, next) {
    try { return paged(res, await service.orders.list(req.query)); } catch (err) { next(err); }
  }

  async ordersShow(req, res, next) {
    try { return response.success(res, await service.orders.getById(req.params.id)); } catch (err) { next(err); }
  }

  async ordersStore(req, res, next) {
    try { return response.success(res, await service.orders.create(req.body, req), 'Bon de commande créé', 201); } catch (err) { next(err); }
  }

  async ordersUpdate(req, res, next) {
    try { return response.success(res, await service.orders.update(req.params.id, req.body, req), 'Bon de commande mis à jour'); } catch (err) { next(err); }
  }

  async ordersStatus(req, res, next) {
    try { return response.success(res, await service.orders.changeStatus(req.params.id, req.body, req), 'Statut du bon de commande mis à jour'); } catch (err) { next(err); }
  }

  async ordersCancel(req, res, next) {
    try {
      return response.success(res, await service.orders.changeStatus(req.params.id, { ...req.body, status: 'cancelled' }, req), 'Bon de commande annulé');
    } catch (err) { next(err); }
  }

  async ordersDestroy(req, res, next) {
    try { return response.success(res, await service.orders.remove(req.params.id, req), 'Bon de commande supprimé'); } catch (err) { next(err); }
  }

  async ordersReceive(req, res, next) {
    try {
      const po = await service.orders.receive(req.params.id, req.body, req);
      return response.success(res, po, po.status?.code === 'received' ? 'Réception enregistrée : BC entièrement reçu' : 'Réception partielle enregistrée');
    } catch (err) { next(err); }
  }
}

module.exports = new PurchasingController();
