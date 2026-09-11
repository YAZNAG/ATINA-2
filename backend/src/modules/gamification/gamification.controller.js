const service = require('./gamification.service');
const plays = require('./gamification.plays.service');
const response = require('../../utils/response');

/** Erreur métier avec détails (ex. refus de suppression : verrous + « Désactiver à la place »). */
function handle(err, res, next) {
  if (err && err.statusCode && err.details) {
    return response.error(res, err.message, err.statusCode, err.details);
  }
  return next(err);
}

class GamificationController {
  // ── référentiels ──
  async lookups(req, res, next) {
    try { return response.success(res, await service.getLookups()); } catch (err) { return next(err); }
  }

  async nodePacks(req, res, next) {
    try { return response.success(res, await service.getNodePacks(req.params.nodeId)); } catch (err) { return next(err); }
  }

  async nodeSkus(req, res, next) {
    try { return response.success(res, await service.searchNodeSkus(req.params.nodeId, req.query)); } catch (err) { return next(err); }
  }

  // ── jeux ──
  async index(req, res, next) {
    try {
      const { data, pagination } = await service.listGames(req.query);
      return res.json({ success: true, message: 'Success', data, pagination });
    } catch (err) { return next(err); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getGame(req.params.id)); } catch (err) { return next(err); }
  }

  async store(req, res, next) {
    try {
      const result = await service.createGame(req, req.body);
      return response.success(res, result, 'Jeu créé (inactif) — activez-le pour le rendre visible dans l’app', 201);
    } catch (err) { return next(err); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.updateGame(req, req.params.id, req.body), 'Jeu mis à jour'); } catch (err) { return next(err); }
  }

  async activate(req, res, next) {
    try { return response.success(res, await service.activateGame(req, req.params.id), 'Jeu activé'); } catch (err) { return next(err); }
  }

  async deactivate(req, res, next) {
    try { return response.success(res, await service.deactivateGame(req, req.params.id), 'Jeu désactivé'); } catch (err) { return next(err); }
  }

  async deleteCheck(req, res, next) {
    try { return response.success(res, await service.deleteCheck(req.params.id)); } catch (err) { return next(err); }
  }

  async destroy(req, res, next) {
    try { return response.success(res, await service.deleteGame(req, req.params.id), 'Jeu supprimé'); } catch (err) { return handle(err, res, next); }
  }

  // ── lots ──
  async addPrize(req, res, next) {
    try { return response.success(res, await service.addPrize(req, req.params.id, req.body), 'Lot ajouté', 201); } catch (err) { return next(err); }
  }

  async updatePrize(req, res, next) {
    try { return response.success(res, await service.updatePrize(req, req.params.id, req.params.prizeId, req.body), 'Lot mis à jour'); } catch (err) { return next(err); }
  }

  async deletePrize(req, res, next) {
    try { return response.success(res, await service.deletePrize(req, req.params.id, req.params.prizeId), 'Lot supprimé'); } catch (err) { return next(err); }
  }

  // ── participations (lecture seule) ──
  async plays(req, res, next) {
    try {
      const { data, pagination, summary } = await plays.listPlays(req.query);
      return res.json({ success: true, message: 'Success', data, pagination, summary });
    } catch (err) { return next(err); }
  }

  async gamePlays(req, res, next) {
    try {
      const { data, pagination, summary } = await plays.listPlays({ ...req.query, game_id: req.params.id });
      return res.json({ success: true, message: 'Success', data, pagination, summary });
    } catch (err) { return next(err); }
  }

  async exportPlays(req, res, next) {
    try { return response.success(res, await plays.exportPlays(req.query)); } catch (err) { return next(err); }
  }

  async showPlay(req, res, next) {
    try { return response.success(res, await plays.getPlay(req.params.id)); } catch (err) { return next(err); }
  }
}

module.exports = new GamificationController();
