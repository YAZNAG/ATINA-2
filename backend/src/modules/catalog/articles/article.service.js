const repo = require('./article.repository');
const guard = require('./articleReferential.guard');
const articleImageService = require('../articleImages/articleImage.service');

const REF_KEYS = [
  'family_id',
  'category_id',
  'sub_category_id',
  'brand_id',
  'unit_id',
  'packaging_type_id',
  'conservation_type_id',
  'article_type_id',
  'article_status_id',
  'tax_id',
  'purchase_unit_id',
  'sale_unit_id',
];

const toBool = (v) => v === 'true' || v === true || v === '1' || v === 1;

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

  async create(data) {
    const payload = this._mapData(data);
    await this._assertSkuBarcodeUnique(payload.sku, payload.barcode, null);
    await this._validateReferences(payload);
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Article introuvable' };

    const mapped = this._mapData(data);
    const merged = this._mergeReferentialSnapshot(item, mapped);

    if (mapped.sku !== undefined) {
      const exists = await repo.findBySku(mapped.sku, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce SKU est déjà utilisé' };
    }
    if (mapped.barcode !== undefined) {
      const exists = await repo.findByBarcode(mapped.barcode, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code-barres est déjà utilisé' };
    }

    await this._validateReferences(merged);

    const updateData = { ...mapped };
    Object.assign(updateData, {
      family_id: merged.family_id,
      category_id: merged.category_id,
      sub_category_id: merged.sub_category_id,
    });

    await repo.update(Number(id), updateData);
    return repo.findById(Number(id));
  }

  async delete(id) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Article introuvable' };
    await articleImageService.softDeleteAllForArticle(Number(id));
    await repo.softDelete(Number(id));
  }

  _mergeReferentialSnapshot(existing, mapped) {
    const out = {};
    for (const k of REF_KEYS) {
      out[k] = mapped[k] !== undefined ? mapped[k] : existing[k];
    }
    return out;
  }

  async _assertSkuBarcodeUnique(sku, barcode, excludeId) {
    if (sku) {
      const exists = await repo.findBySku(sku, excludeId);
      if (exists) throw { statusCode: 409, message: 'Ce SKU est déjà utilisé' };
    }
    if (barcode) {
      const exists = await repo.findByBarcode(barcode, excludeId);
      if (exists) throw { statusCode: 409, message: 'Ce code-barres est déjà utilisé' };
    }
  }

  async _validateReferences(payload) {
    const snapshot = { ...payload };
    await guard.validateTaxonomy(snapshot);
    Object.assign(payload, {
      family_id: snapshot.family_id,
      category_id: snapshot.category_id,
      sub_category_id: snapshot.sub_category_id,
    });
    await guard.validateOptionalRefs(snapshot);
  }

  _mapData(data) {
    const d = { ...data };

    if (d.barcode !== undefined) {
      const b = String(d.barcode).trim();
      d.barcode = b === '' ? null : b;
    }

    const numFields = [
      'family_id',
      'category_id',
      'sub_category_id',
      'brand_id',
      'unit_id',
      'packaging_type_id',
      'conservation_type_id',
      'article_type_id',
      'article_status_id',
      'tax_id',
      'purchase_unit_id',
      'sale_unit_id',
    ];
    const floatFields = ['weight', 'volume', 'min_stock', 'reorder_stock', 'max_stock'];
    const boolFields = [
      'is_sellable',
      'is_stockable',
      'is_perishable',
      'requires_expiry_date',
      'requires_batch_number',
      'is_active',
    ];

    numFields.forEach((f) => {
      if (d[f] !== undefined) d[f] = d[f] === '' || d[f] === null ? null : Number(d[f]);
    });
    floatFields.forEach((f) => {
      if (d[f] !== undefined) d[f] = d[f] === '' || d[f] === null ? null : parseFloat(String(d[f]));
    });
    boolFields.forEach((f) => {
      if (d[f] !== undefined) d[f] = toBool(d[f]);
    });

    return d;
  }
}

module.exports = new ArticleService();
