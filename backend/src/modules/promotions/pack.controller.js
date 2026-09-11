const service  = require('./pack.service');
const response = require('../../utils/response');
const { getFilePath, toPublicUrl } = require('../../utils/fileStorage');

/**
 * Corps d'une requête pack : JSON classique, ou multipart (champ fichier `image`
 * jpg/png/webp ≤ 5 Mo + champs texte, `items` sérialisé en JSON). Le fichier
 * envoyé remplace l'URL d'image saisie.
 */
function packBody(req) {
  const body = { ...(req.body || {}) };
  if (typeof body.items === 'string') {
    try { body.items = JSON.parse(body.items); } catch { throw { statusCode: 400, message: 'Composition (items) illisible' }; }
  }
  const file = req.files?.image?.[0];
  if (file) body.image_url = toPublicUrl(getFilePath(file, 'packs'));
  return body;
}

/** Erreur métier avec détails (ex. raisons du gel de composition) : renvoyée telle quelle. */
function handle(err, res, next) {
  if (err && err.statusCode && err.details) {
    return res.status(err.statusCode).json({ success: false, message: err.message, data: err.details });
  }
  return next(err);
}

class AdminPacksController {
  async index(req, res, next) {
    try {
      const result = await service.getAll(req.query);
      return res.json({ success: true, message: 'Success', ...result });
    } catch (err) { handle(err, res, next); }
  }

  async show(req, res, next) {
    try { return response.success(res, await service.getById(req.params.id)); }
    catch (err) { handle(err, res, next); }
  }

  async lock(req, res, next) {
    try { return response.success(res, await service.getLock(req.params.id)); }
    catch (err) { handle(err, res, next); }
  }

  async eligibleSkus(req, res, next) {
    try { return response.success(res, await service.eligibleSkus(req.query)); }
    catch (err) { handle(err, res, next); }
  }

  async store(req, res, next) {
    try { return response.success(res, await service.create(packBody(req), req), 'Pack créé', 201); }
    catch (err) { handle(err, res, next); }
  }

  async update(req, res, next) {
    try { return response.success(res, await service.update(req.params.id, packBody(req), req), 'Pack mis à jour'); }
    catch (err) { handle(err, res, next); }
  }

  /** POST /packs/:id/image — envoi du fichier image (champ `image`), autorisé même composition gelée. */
  async uploadImage(req, res, next) {
    try {
      const file = req.files?.image?.[0];
      if (!file) throw { statusCode: 400, message: 'Aucun fichier image reçu (jpg, png ou webp, 5 Mo max)' };
      const image_url = toPublicUrl(getFilePath(file, 'packs'));
      return response.success(res, await service.update(req.params.id, { image_url }, req), 'Image du pack mise à jour');
    } catch (err) { handle(err, res, next); }
  }

  async activate(req, res, next) {
    try { return response.success(res, await service.setActive(req.params.id, true, req), 'Pack activé'); }
    catch (err) { handle(err, res, next); }
  }

  async deactivate(req, res, next) {
    try { return response.success(res, await service.setActive(req.params.id, false, req), 'Pack désactivé'); }
    catch (err) { handle(err, res, next); }
  }

  async destroy(req, res, next) {
    try { await service.remove(req.params.id, req); return response.success(res, null, 'Pack supprimé'); }
    catch (err) { handle(err, res, next); }
  }

  async duplicate(req, res, next) {
    try {
      const result = await service.duplicateToNode(req.params.id, req.body.node_id, req);
      const msg = result.warnings.length
        ? `Pack dupliqué (inactif) avec ${result.warnings.length} composant(s) indisponible(s) sur le node cible : corrigez la composition avant activation`
        : 'Pack dupliqué (inactif)';
      return response.success(res, result, msg, 201);
    } catch (err) { handle(err, res, next); }
  }
}

module.exports = new AdminPacksController();
