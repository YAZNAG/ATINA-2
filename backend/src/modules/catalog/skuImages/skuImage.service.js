const prisma = require('../../../config/database');
const repo = require('./skuImage.repository');

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const pickPayload = (body) => ({
  sku_id: body.sku_id,
  url: body.url,
  alt_fr: emptyToNull(body.alt_fr),
  alt_ar: emptyToNull(body.alt_ar),
  is_primary: Boolean(body.is_primary),
  sort_order: body.sort_order !== undefined && body.sort_order !== '' ? Number(body.sort_order) : 0,
});

class SkuImageService {
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Image SKU introuvable' };
    return item;
  }

  async create(body) {
    const data = pickPayload(body);
    if (!data.url?.trim()) throw { statusCode: 422, message: 'URL requise' };

    return prisma.$transaction(async (tx) => {
      if (data.is_primary) {
        await tx.skuImage.updateMany({
          where: { sku_id: data.sku_id, is_primary: true },
          data: { is_primary: false },
        });
      }
      return tx.skuImage.create({ data });
    });
  }

  async update(id, body) {
    const existing = await repo.findById(id);
    if (!existing) throw { statusCode: 404, message: 'Image SKU introuvable' };
    const merged = {
      sku_id: body.sku_id ?? existing.sku_id,
      url: body.url ?? existing.url,
      alt_fr: body.alt_fr !== undefined ? body.alt_fr : existing.alt_fr,
      alt_ar: body.alt_ar !== undefined ? body.alt_ar : existing.alt_ar,
      is_primary: body.is_primary !== undefined ? body.is_primary : existing.is_primary,
      sort_order:
        body.sort_order !== undefined && body.sort_order !== ''
          ? body.sort_order
          : existing.sort_order,
    };
    const data = pickPayload(merged);
    if (!data.url?.trim()) throw { statusCode: 422, message: 'URL requise' };

    return prisma.$transaction(async (tx) => {
      if (data.is_primary) {
        await tx.skuImage.updateMany({
          where: { sku_id: data.sku_id, is_primary: true, NOT: { id } },
          data: { is_primary: false },
        });
      }
      return tx.skuImage.update({
        where: { id },
        data: {
          sku_id: data.sku_id,
          url: data.url,
          alt_fr: data.alt_fr,
          alt_ar: data.alt_ar,
          is_primary: data.is_primary,
          sort_order: data.sort_order,
        },
      });
    });
  }

  async delete(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Image SKU introuvable' };
    await repo.remove(id);
  }
}

module.exports = new SkuImageService();
