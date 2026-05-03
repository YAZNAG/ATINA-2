const service = require('./articleSkuImage.service');
const response = require('../../../utils/response');

class ArticleSkuImageController {
  async index(req, res, next) {
    try {
      const data = await service.listByArticle(req.params.articleId);
      return response.success(res, data);
    } catch (err) {
      next(err);
    }
  }

  async addImages(req, res, next) {
    try {
      const data = await service.addImages(req.params.articleId, req.files);
      return response.success(res, data, 'Images ajoutées', 201);
    } catch (err) {
      next(err);
    }
  }

  async setPrimary(req, res, next) {
    try {
      const data = await service.setPrimary(req.params.articleId, req.params.imageId);
      return response.success(res, data, 'Image principale mise à jour');
    } catch (err) {
      next(err);
    }
  }

  async updateSort(req, res, next) {
    try {
      const data = await service.updateSortOrder(
        req.params.articleId,
        req.params.imageId,
        req.body.sort_order,
      );
      return response.success(res, data, 'Ordre mis à jour');
    } catch (err) {
      next(err);
    }
  }

  async destroy(req, res, next) {
    try {
      await service.deleteImage(req.params.articleId, req.params.imageId);
      return response.success(res, null, 'Image supprimée');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ArticleSkuImageController();
