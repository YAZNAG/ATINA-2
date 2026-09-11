const service  = require('./promotions.service');
const response = require('../../utils/response');
const { getFilePath, toPublicUrl } = require('../../utils/fileStorage');

function withUploadedImage(req) {
  const body = { ...req.body };
  const file = req.files?.image?.[0];
  if (file) {
    body.image_url = toPublicUrl(getFilePath(file, 'flash_sales'));
  }
  return body;
}

/** Erreur métier enrichie (refus de suppression avec compteur de commandes actives, etc.). */
function handle(err, res, next) {
  if (err && err.statusCode && err.details) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }
  return next(err);
}

class promotionsController {
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

  async lookups(req, res, next) {
    try { return response.success(res, await service.getFlashLookups(req.query)); }
    catch (err) { handle(err, res, next); }
  }

  async ceiling(req, res, next) {
    try { return response.success(res, await service.getCeiling(req.query)); }
    catch (err) { handle(err, res, next); }
  }

  async create(req, res, next) {
    try {
      return response.success(res, await service.CreatePromotion(withUploadedImage(req), req), 'Vente flash créée', 201);
    } catch (err) { handle(err, res, next); }
  }

  async update(req, res, next) {
    try {
      return response.success(res, await service.updatePromotion(req.params.id, withUploadedImage(req), req), 'Vente flash mise à jour');
    } catch (err) { handle(err, res, next); }
  }

  async setStatus(req, res, next) {
    try {
      const data = await service.setActive(req.params.id, req.body?.is_active, req);
      return response.success(res, data, data.is_active ? 'Vente flash activée' : 'Vente flash désactivée');
    } catch (err) { handle(err, res, next); }
  }

  async deletionCheck(req, res, next) {
    try {
      return response.success(res, await service.getDeletionCheck(req.params.id, req, { auditRefusal: req.query.attempt === 'true' }));
    } catch (err) { handle(err, res, next); }
  }

  async remove(req, res, next) {
    try {
      await service.removePromotion(req.params.id, req);
      return response.success(res, null, 'Vente flash supprimée');
    } catch (err) { handle(err, res, next); }
  }
}
module.exports = new promotionsController();
