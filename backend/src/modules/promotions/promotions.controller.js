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

class promotionsController {
    async index(req, res, next) {
        try{
            const result= await service.getAll(req.query)
            return res.json({ success: true, message: 'Success', ...result });
        } catch (err) { next(err); }
    }

    async show(req, res, next) {
        try { return response.success(res, await service.getById(req.params.id)); }
        catch (err) { next(err); }
    }

    async create(req, res, next){
        try{
            return response.success(res, await service.CreatePromotion(withUploadedImage(req), req.user.id), 'Promotion créée', 201);
        } catch (err) { next(err); }
    }

    async update(req, res, next){
        try{
            return response.success(res, await service.updatePromotion(req.params.id, withUploadedImage(req)), 'Promotion mise à jour');
        } catch (err) { next(err); }
    }

    async remove(req, res, next){
        try{
            await service.removePromotion(req.params.id);
            return response.success(res, null, 'Promotion supprimée');
        } catch (err) { next(err); }
    }
}
module.exports = new promotionsController();
