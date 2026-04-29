const service = require('./articleImage.service');
const response = require('../../../utils/response');

class ArticleImageController {
  async addImages(req, res, next) {
    try {
      const data = await service.addImages(req.params.articleId, req.files);
      return response.success(res, data, 'Images ajoutées', 201);
    } catch (err) { next(err); }
  }

  async setMain(req, res, next) {
    try {
      const data = await service.setMain(req.params.articleId, req.params.imageId);
      return response.success(res, data, 'Image principale mise à jour');
    } catch (err) { next(err); }
  }

  async destroy(req, res, next) {
    try {
      await service.deleteImage(req.params.imageId);
      return response.success(res, null, 'Image supprimée');
    } catch (err) { next(err); }
  }
}

module.exports = new ArticleImageController();
