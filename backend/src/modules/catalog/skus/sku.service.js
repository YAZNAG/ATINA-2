const prisma = require('../../../config/database');
const repo = require('./sku.repository');
const { INCLUDE } = require('./sku.repository');
const guard = require('./skuReferential.guard');
const skuImageService = require('../skuImages/skuImage.service');

const REF_KEYS = ['sku_family_id', 'sku_subfamily_id'];

const INPUT_KEYS = [
  'sku_code',
  'ean13',
  'name_fr',
  'name_ar',
  'description_fr',
  'description_ar',
  'brand_id',
  'sku_family_id',
  'sku_subfamily_id',
  'category_id',
  'status',
  'conservation_type_id',
  'tax_id',
  'unit_sale',
  'unit_purchase',
  'coeff',
  'price',
  'vat_rate',
  'weight_g',
  'volume_ml',
  'is_active',
  'unit_purchase_id',
  'unit_sale_id',
  'packaging_type_id',
];

const toBool = (v) => v === 'true' || v === true || v === '1' || v === 1;

class SkuService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };
    return item;
  }

  async create(data) {
    const mapped = this._mapData(data);
    if (!mapped.sku_code || !String(mapped.sku_code).trim()) {
      throw { statusCode: 400, message: 'Code SKU requis' };
    }
    await this._assertSkuEanUnique(mapped.sku_code.trim(), mapped.ean13 ?? null, null);
    await this._validateReferences(mapped, mapped);
    if (mapped.sku_family_id == null) {
      throw { statusCode: 400, message: 'Famille SKU requise (ou sous-famille pour la déduire)' };
    }
    if (mapped.price === undefined || mapped.price === null || Number.isNaN(Number(mapped.price))) {
      throw { statusCode: 400, message: 'Prix requis' };
    }
    const priceNum = Number(mapped.price);
    if (priceNum < 0) throw { statusCode: 400, message: 'Le prix doit être positif ou nul' };

    if (mapped.tax_id != null) {
      const tax = await prisma.tax.findUnique({ where: { id: mapped.tax_id }, select: { rate: true } });
      if (tax) mapped.vat_rate = Number(tax.rate);
    }

    const payload = this._toPrismaPayload(mapped);
    return repo.create(payload);
  }

  async update(id, data) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };

    const mapped = this._mapData(data);
    const merged = this._mergeReferentialSnapshot(item, mapped);

    if (mapped.sku_code !== undefined) {
      const code = String(mapped.sku_code).trim();
      const exists = await repo.findBySkuCode(code, id);
      if (exists) throw { statusCode: 409, message: 'Ce code SKU est déjà utilisé' };
    }
    if (mapped.ean13 !== undefined && mapped.ean13 !== null) {
      const exists = await repo.findByEan13(mapped.ean13, id);
      if (exists) throw { statusCode: 409, message: 'Ce code EAN-13 est déjà utilisé' };
    }
    if (mapped.tax_id != null) {
      const tax = await prisma.tax.findUnique({ where: { id: mapped.tax_id }, select: { rate: true } });
      if (tax) mapped.vat_rate = Number(tax.rate);
    }

    await this._validateReferences(merged, mapped);

    const updateData = { ...mapped };
    Object.assign(updateData, {
      sku_family_id: merged.sku_family_id,
      sku_subfamily_id: merged.sku_subfamily_id,
    });

    if (updateData.price !== undefined && updateData.price !== null) {
      const p = Number(updateData.price);
      if (Number.isNaN(p) || p < 0) throw { statusCode: 400, message: 'Le prix doit être positif ou nul' };
    }

    const prismaPayload = this._toPrismaPayload(updateData);
    await repo.update(id, prismaPayload);
    return repo.findById(id);
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };
    await skuImageService.softDeleteAllForSku(id);
    await repo.softDelete(id);
  }

  _mergeReferentialSnapshot(existing, mapped) {
    const out = {};
    for (const k of REF_KEYS) {
      out[k] = mapped[k] !== undefined ? mapped[k] : existing[k];
    }
    return out;
  }

  async _assertSkuEanUnique(sku_code, ean13, excludeId) {
    const existsSku = await repo.findBySkuCode(String(sku_code).trim(), excludeId);
    if (existsSku) throw { statusCode: 409, message: 'Ce code SKU est déjà utilisé' };
    if (ean13) {
      const existsEan = await repo.findByEan13(ean13, excludeId);
      if (existsEan) throw { statusCode: 409, message: 'Ce code EAN-13 est déjà utilisé' };
    }
  }

  async _validateReferences(taxonomyPayload, fullPayload) {
    const snapshot = { ...taxonomyPayload };
    await guard.validateTaxonomy(snapshot);
    Object.assign(taxonomyPayload, {
      sku_family_id: snapshot.sku_family_id,
      sku_subfamily_id: snapshot.sku_subfamily_id,
    });
    await guard.validateOptionalRefs(fullPayload ?? taxonomyPayload);
  }

  _mapData(body) {
    const raw = body && typeof body === 'object' ? { ...body } : {};
    if (raw.sku !== undefined && raw.sku_code === undefined) raw.sku_code = raw.sku;
    if (raw.barcode !== undefined && raw.ean13 === undefined) raw.ean13 = raw.barcode;

    const out = {};
    for (const k of INPUT_KEYS) {
      if (raw[k] !== undefined) out[k] = raw[k];
    }

    if (out.ean13 !== undefined) {
      const t = String(out.ean13).trim();
      out.ean13 = t === '' ? null : t;
    }

    const intFields = ['brand_id', 'conservation_type_id', 'tax_id', 'weight_g', 'volume_ml', 'unit_purchase_id', 'unit_sale_id', 'packaging_type_id'];
    intFields.forEach((f) => {
      if (out[f] !== undefined) {
        if (out[f] === '' || out[f] === null) out[f] = null;
        else {
          const n = Number(out[f]);
          out[f] = Number.isNaN(n) ? null : n;
        }
      }
    });

    const uuidFields = ['sku_family_id', 'sku_subfamily_id', 'category_id'];
    uuidFields.forEach((f) => {
      if (out[f] !== undefined && (out[f] === '' || out[f] === null)) out[f] = null;
    });

    const decFields = ['coeff', 'price', 'vat_rate'];
    decFields.forEach((f) => {
      if (out[f] !== undefined) {
        if (out[f] === '' || out[f] === null) delete out[f];
        else {
          const n = parseFloat(String(out[f]));
          if (!Number.isNaN(n)) out[f] = n;
        }
      }
    });

    if (out.sku_code !== undefined) out.sku_code = String(out.sku_code).trim();
    if (out.is_active !== undefined) out.is_active = toBool(out.is_active);

    return out;
  }

  _toPrismaPayload(mapped) {
    const data = {};
    const assign = (key, value) => {
      if (value !== undefined) data[key] = value;
    };

    assign('sku_code', mapped.sku_code);
    assign('ean13', mapped.ean13);
    assign('name_fr', mapped.name_fr);
    assign('name_ar', mapped.name_ar);
    assign('description_fr', mapped.description_fr);
    assign('description_ar', mapped.description_ar);
    assign('brand_id', mapped.brand_id);
    assign('sku_family_id', mapped.sku_family_id);
    assign('sku_subfamily_id', mapped.sku_subfamily_id);
    assign('category_id', mapped.category_id);
    assign('status', mapped.status);
    assign('conservation_type_id', mapped.conservation_type_id);
    assign('tax_id', mapped.tax_id);
    assign('unit_sale', mapped.unit_sale ?? 'unit');
    assign('unit_purchase', mapped.unit_purchase ?? 'unit');
    assign('coeff', mapped.coeff ?? 1);
    assign('price', mapped.price);
    assign('vat_rate', mapped.vat_rate ?? 20);
    assign('weight_g', mapped.weight_g);
    assign('volume_ml', mapped.volume_ml);
    assign('is_active', mapped.is_active);
    assign('unit_purchase_id', mapped.unit_purchase_id);
    assign('unit_sale_id', mapped.unit_sale_id);
    assign('packaging_type_id', mapped.packaging_type_id);

    return data;
  }

  async toggleStatus(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };
    return repo.update(id, { is_active: !item.is_active });
  }

  async restore(id) {
    const item = await repo.findByIdIncludingDeleted(id);
    if (!item) throw { statusCode: 404, message: 'SKU introuvable' };
    if (!item.deleted_at && !item.is_deleted) throw { statusCode: 400, message: "Ce SKU n'est pas supprimé" };
    return repo.restore(id);
  }
}

module.exports = new SkuService();