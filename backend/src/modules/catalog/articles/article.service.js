const prisma = require('../../../config/database');
const repo = require('./article.repository');
const { INCLUDE } = require('./article.repository');
const { setArticleSkuUuid, getArticleSkuUuid } = require('../../../utils/articleSkuLink');
const guard = require('./articleReferential.guard');
const articleImageService = require('../articleImages/articleImage.service');

const REF_KEYS = ['family_id', 'category_id', 'sub_category_id', 'brand_id'];

const INPUT_KEYS = [
  'sku_code',
  'ean13',
  'name_fr',
  'name_ar',
  'description_fr',
  'description_ar',
  'brand_id',
  'family_id',
  'sub_category_id',
  'category_id',
  'article_type_id',
  'article_status_id',
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
    const mapped = this._mapData(data);
    if (!mapped.sku_code || !String(mapped.sku_code).trim()) {
      throw { statusCode: 400, message: 'Code SKU requis' };
    }
    await this._assertSkuEanUnique(mapped.sku_code.trim(), mapped.ean13 ?? null, null);
    await this._validateReferences(mapped, mapped);
    if (mapped.family_id == null || Number.isNaN(Number(mapped.family_id))) {
      throw { statusCode: 400, message: 'Famille requise (ou catégorie / sous-catégorie pour la déduire)' };
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
    return prisma.$transaction(async (tx) => {
      const sku = await tx.sku.create({ data: {} });
      // `select: { id: true }` : évite un `RETURNING *` sur toutes les colonnes (ex. `sku_uuid`) si la table
      // n'est pas encore migrée -- erreur PG « colonne … inexistante » sur `article.create`.
      const created = await tx.article.create({
        data: payload,
        select: { id: true },
      });
      await setArticleSkuUuid(tx, created.id, sku.id);
      return tx.article.findFirst({ where: { id: created.id }, include: INCLUDE });
    });
  }

  async update(id, data) {
    const item = await repo.findById(Number(id));
    if (!item) throw { statusCode: 404, message: 'Article introuvable' };

    const mapped = this._mapData(data);
    const merged = this._mergeReferentialSnapshot(item, mapped);

    if (mapped.sku_code !== undefined) {
      const code = String(mapped.sku_code).trim();
      const exists = await repo.findBySkuCode(code, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code SKU est déjà utilisé' };
    }
    if (mapped.ean13 !== undefined && mapped.ean13 !== null) {
      const exists = await repo.findByEan13(mapped.ean13, Number(id));
      if (exists) throw { statusCode: 409, message: 'Ce code EAN-13 est déjà utilisé' };
    }
    if (mapped.tax_id != null) {
    const tax = await prisma.tax.findUnique({ where: { id: mapped.tax_id }, select: { rate: true } });
    if (tax) mapped.vat_rate = Number(tax.rate);   
  }

    await this._validateReferences(merged, mapped);

    const updateData = { ...mapped };
    Object.assign(updateData, {
      family_id: merged.family_id,
      category_id: merged.category_id,
      sub_category_id: merged.sub_category_id,
    });

    if (updateData.price !== undefined && updateData.price !== null) {
      const p = Number(updateData.price);
      if (Number.isNaN(p) || p < 0) throw { statusCode: 400, message: 'Le prix doit être positif ou nul' };
    }

    const prismaPayload = this._toPrismaPayload(updateData);
    const hasSku =
      item.sku_uuid ?? (await getArticleSkuUuid(prisma, Number(id)));
    if (!hasSku) {
      const sku = await prisma.sku.create({ data: {} });
      await setArticleSkuUuid(prisma, Number(id), sku.id);
    }
    await repo.update(Number(id), prismaPayload);
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
      family_id: snapshot.family_id,
      category_id: snapshot.category_id,
      sub_category_id: snapshot.sub_category_id,
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

    const intFields = ['brand_id', 'family_id', 'sub_category_id', 'category_id', 'article_type_id', 'article_status_id', 'conservation_type_id', 'tax_id', 'weight_g', 'volume_ml'];
    intFields.forEach((f) => {
      if (out[f] !== undefined) {
        if (out[f] === '' || out[f] === null) out[f] = null;
        else {
          const n = Number(out[f]);
          out[f] = Number.isNaN(n) ? null : n;
        }
      }
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
    assign('family_id', mapped.family_id);
    assign('sub_category_id', mapped.sub_category_id);
    assign('category_id', mapped.category_id);
    assign('article_type_id', mapped.article_type_id);
    assign('article_status_id', mapped.article_status_id);
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

    return data;
  }
}

module.exports = new ArticleService();
