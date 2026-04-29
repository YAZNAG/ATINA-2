const repo = require('./article.repository');
const prisma = require('../../../config/database');
const fileUploadService = require('../../../services/fileUpload.service');

const FOLDER = 'articles';

const toNum = (v) => (v !== undefined && v !== '' ? Number(v) : undefined);
const toBool = (v) => v === 'true' || v === true || v === '1' || v === 1;
const toFloat = (v) => (v !== undefined && v !== '' ? parseFloat(v) : undefined);

class ArticleService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Article introuvable' };
    return item;
  }

  async create(data, files) {
    if (data.sku) {
      const exists = await repo.findBySku(data.sku);
      if (exists) throw { statusCode: 409, message: 'Ce SKU est déjà utilisé' };
    }
    if (data.barcode) {
      const exists = await repo.findByBarcode(data.barcode);
      if (exists) throw { statusCode: 409, message: 'Ce code-barres est déjà utilisé' };
    }

    const articleData = this._mapData(data);
    const article = await repo.create(articleData);

    if (files?.image?.[0]) {
      const imgPath = fileUploadService.extractPaths(files, FOLDER).image_path;
      await prisma.articleImage.create({
        data: { article_id: article.id, image_path: imgPath, is_main: true, sort_order: 0 },
      });
    }

    return repo.findById(article.id);
  }

  async update(id, data, files) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Article introuvable' };

    if (data.sku) {
      const exists = await repo.findBySku(data.sku, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce SKU est déjà utilisé' };
    }
    if (data.barcode) {
      const exists = await repo.findByBarcode(data.barcode, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code-barres est déjà utilisé' };
    }

    const updateData = this._mapData(data);
    await repo.update(Number(id), updateData);

    if (files?.image?.[0]) {
      const imgPath = fileUploadService.extractPaths(files, FOLDER).image_path;
      const mainImg = item.images.find((i) => i.is_main);
      if (mainImg) {
        fileUploadService.deleteFileByPath(mainImg.image_path);
        await prisma.articleImage.update({ where: { id: mainImg.id }, data: { image_path: imgPath } });
      } else {
        await prisma.articleImage.create({
          data: { article_id: Number(id), image_path: imgPath, is_main: true, sort_order: 0 },
        });
      }
    }

    return repo.findById(Number(id));
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Article introuvable' };
    item.images.forEach((img) => fileUploadService.deleteFileByPath(img.image_path));
    await repo.softDelete(Number(id));
  }

  _mapData(data) {
    const d = { ...data };
    const numFields = ['family_id', 'category_id', 'sub_category_id', 'brand_id', 'unit_id',
      'packaging_type_id', 'conservation_type_id', 'article_type_id', 'article_status_id',
      'tax_id', 'purchase_unit_id', 'sale_unit_id'];
    const floatFields = ['weight', 'volume', 'min_stock', 'reorder_stock', 'max_stock'];
    const boolFields = ['is_sellable', 'is_stockable', 'is_perishable', 'requires_expiry_date', 'requires_batch_number', 'is_active'];

    numFields.forEach((f) => { if (d[f] !== undefined) d[f] = d[f] ? Number(d[f]) : null; });
    floatFields.forEach((f) => { if (d[f] !== undefined) d[f] = d[f] ? parseFloat(d[f]) : null; });
    boolFields.forEach((f) => { if (d[f] !== undefined) d[f] = toBool(d[f]); });

    return d;
  }
}

module.exports = new ArticleService();
