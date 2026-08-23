const prisma = require('../../../config/database');
const fileUploadService = require('../../../services/fileUpload.service');
const { getFilePath } = require('../../../utils/fileStorage');

const FOLDER = 'skus';

class SkuImageService {
  async listBySku(skuId) {
    const sku = await prisma.sku.findFirst({
      where: { id: skuId, deleted_at: null, is_deleted: false },
    });
    if (!sku) throw { statusCode: 404, message: 'SKU introuvable' };
    return prisma.skuImage.findMany({
      where: { sku_id: skuId, deleted_at: null },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
  }

  async addImages(skuId, files) {
    const sku = await prisma.sku.findFirst({
      where: { id: skuId, deleted_at: null, is_deleted: false },
    });
    if (!sku) throw { statusCode: 404, message: 'SKU introuvable' };
    if (!files?.images?.length) throw { statusCode: 400, message: 'Aucune image fournie' };

    const agg = await prisma.skuImage.aggregate({
      where: { sku_id: skuId, deleted_at: null },
      _max: { sort_order: true },
    });
    let nextOrder = (agg._max.sort_order ?? -1) + 1;

    const hasPrimary = await prisma.skuImage.count({
      where: { sku_id: skuId, is_primary: true, deleted_at: null },
    });

    const rows = files.images.map((file, idx) => {
      const path = getFilePath(file, FOLDER);
      return {
        sku_id: skuId,
        url: path,
        is_primary: hasPrimary === 0 && idx === 0,
        sort_order: nextOrder + idx,
      };
    });

    await prisma.skuImage.createMany({ data: rows });
    return this.listBySku(skuId);
  }

  async setPrimary(skuId, imageId) {
    const img = await prisma.skuImage.findFirst({
      where: { id: imageId, sku_id: skuId, deleted_at: null },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable pour ce SKU' };

    await prisma.$transaction([
      prisma.skuImage.updateMany({
        where: { sku_id: skuId, deleted_at: null },
        data: { is_primary: false },
      }),
      prisma.skuImage.update({ where: { id: img.id }, data: { is_primary: true } }),
    ]);

    return prisma.skuImage.findFirst({ where: { id: img.id } });
  }

  async updateSortOrder(skuId, imageId, sort_order) {
    const order = Number(sort_order);
    if (Number.isNaN(order) || order < 0) {
      throw { statusCode: 400, message: "Ordre d'affichage invalide" };
    }
    const img = await prisma.skuImage.findFirst({
      where: { id: imageId, sku_id: skuId, deleted_at: null },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable pour ce SKU' };
    return prisma.skuImage.update({ where: { id: img.id }, data: { sort_order: order } });
  }

  async deleteImage(skuId, imageId) {
    const img = await prisma.skuImage.findFirst({
      where: { id: imageId, sku_id: skuId, deleted_at: null },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable' };
    fileUploadService.deleteFileByPath(img.url);
    await prisma.skuImage.update({ where: { id: img.id }, data: { deleted_at: new Date() } });
  }

  /** Appelé lors de la suppression d'un SKU : fichiers supprimés + suppression logique des lignes image. */
  async softDeleteAllForSku(skuId) {
    const imgs = await prisma.skuImage.findMany({
      where: { sku_id: skuId, deleted_at: null },
    });
    for (const img of imgs) {
      fileUploadService.deleteFileByPath(img.url);
      await prisma.skuImage.update({
        where: { id: img.id },
        data: { deleted_at: new Date() },
      });
    }
  }
}

module.exports = new SkuImageService();