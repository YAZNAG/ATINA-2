const service  = require('./faq.service');
const response = require('../../utils/response');

class FaqController {
  // Catgories 
  async indexCategories(req, res, next) {
    try { return response.success(res, await service.getAllCategories(req.query)); }
    catch (err) { next(err); }
  }
  async storeCategory(req, res, next) {
    try { return response.success(res, await service.createCategory(req.body), 'Catégorie créée', 201); }
    catch (err) { next(err); }
  }
  async updateCategory(req, res, next) {
    try { return response.success(res, await service.updateCategory(req.params.id, req.body), 'Catégorie mise à jour'); }
    catch (err) { next(err); }
  }
  async destroyCategory(req, res, next) {
    try { await service.removeCategory(req.params.id); return response.success(res, null, 'Catégorie supprimée'); }
    catch (err) { next(err); }
  }

  // Questions
  async indexItems(req, res, next) {
    try { return response.success(res, await service.getAllItems(req.query)); }
    catch (err) { next(err); }
  }
  async showItem(req, res, next) {
    try { return response.success(res, await service.getItemById(req.params.id)); }
    catch (err) { next(err); }
  }
  async storeItem(req, res, next) {
    try { return response.success(res, await service.createItem(req.body), 'Question créée', 201); }
    catch (err) { next(err); }
  }
  async updateItem(req, res, next) {
    try { return response.success(res, await service.updateItem(req.params.id, req.body), 'Question mise à jour'); }
    catch (err) { next(err); }
  }
  async destroyItem(req, res, next) {
    try { await service.removeItem(req.params.id); return response.success(res, null, 'Question supprimée'); }
    catch (err) { next(err); }
  }
}

module.exports = new FaqController();