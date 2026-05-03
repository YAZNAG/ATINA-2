const prisma = require('../../../config/database');
const fileUploadService = require('../../../services/fileUpload.service');
const { getFilePath } = require('../../../utils/fileStorage');
const { setArticleSkuUuid, getArticleSkuUuid } = require('../../../utils/articleSkuLink');

const ARTICLE_WHERE = { deleted_at: null, is_deleted: false };

const folder = 'sku-images';

async function getArticleOrThrow(articleId) {
  const article = await prisma.article.findFirst({
    where: { id: Number(articleId), ...ARTICLE_WHERE },
  });
  if (!article) throw { statusCode: 404, message: 'Article introuvable' };
  return article;
}

async function ensureSkuUuid(articleId) {
  const article = await getArticleOrThrow(articleId);
  const existingUuid = article.sku_uuid ?? (await getArticleSkuUuid(prisma, articleId));
  if (existingUuid) {
    return { article: { ...article, sku_uuid: existingUuid }, skuId: existingUuid };
  }
  const sku = await prisma.sku.create({ data: {} });
  await setArticleSkuUuid(prisma, article.id, sku.id);
  const skuId = (await getArticleSkuUuid(prisma, articleId)) ?? sku.id;
  return { article: { ...article, sku_uuid: skuId }, skuId };
}

async function resolveSkuUuid(articleId, article) {
  return article.sku_uuid ?? (await getArticleSkuUuid(prisma, articleId));
}

class ArticleSkuImageService {
  async listByArticle(articleId) {
    const article = await getArticleOrThrow(articleId);
    const skuUuid = article.sku_uuid ?? (await getArticleSkuUuid(prisma, articleId));
    if (!skuUuid) return [];
    return prisma.skuImage.findMany({
      where: { sku_id: skuUuid },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
  }

  async addImages(articleId, files) {
    await ensureSkuUuid(articleId);
    const skuId =
      (await getArticleSkuUuid(prisma, articleId)) ?? (await getArticleOrThrow(articleId)).sku_uuid;
    if (!skuId) {
      throw { statusCode: 500, message: 'Impossible de lier le SKU logistique à l’article' };
    }
    if (!files?.images?.length) throw { statusCode: 400, message: 'Aucune image fournie' };

    const agg = await prisma.skuImage.aggregate({
      where: { sku_id: skuId },
      _max: { sort_order: true },
    });
    let nextOrder = (agg._max.sort_order ?? -1) + 1;

    const hasPrimary = await prisma.skuImage.count({
      where: { sku_id: skuId, is_primary: true },
    });

    const rows = files.images.map((file, idx) => {
      const url = getFilePath(file, folder);
      return {
        sku_id: skuId,
        url,
        is_primary: hasPrimary === 0 && idx === 0,
        sort_order: nextOrder + idx,
      };
    });

    await prisma.skuImage.createMany({ data: rows });
    return this.listByArticle(articleId);
  }

  async setPrimary(articleId, imageId) {
    const article = await getArticleOrThrow(articleId);
    const skuUuid = await resolveSkuUuid(articleId, article);
    if (!skuUuid) throw { statusCode: 404, message: 'Aucune image pour cet article' };

    const img = await prisma.skuImage.findFirst({
      where: { id: String(imageId), sku_id: skuUuid },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable pour cet article' };

    await prisma.$transaction([
      prisma.skuImage.updateMany({
        where: { sku_id: skuUuid, is_primary: true },
        data: { is_primary: false },
      }),
      prisma.skuImage.update({ where: { id: img.id }, data: { is_primary: true } }),
    ]);

    return prisma.skuImage.findFirst({ where: { id: img.id } });
  }

  async updateSortOrder(articleId, imageId, sort_order) {
    const order = Number(sort_order);
    if (Number.isNaN(order) || order < 0) {
      throw { statusCode: 400, message: 'Ordre d’affichage invalide' };
    }
    const article = await getArticleOrThrow(articleId);
    const skuUuid = await resolveSkuUuid(articleId, article);
    if (!skuUuid) throw { statusCode: 404, message: 'Aucune image' };

    const img = await prisma.skuImage.findFirst({
      where: { id: String(imageId), sku_id: skuUuid },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable' };
    return prisma.skuImage.update({ where: { id: img.id }, data: { sort_order: order } });
  }

  async deleteImage(articleId, imageId) {
    const article = await getArticleOrThrow(articleId);
    const skuUuid = await resolveSkuUuid(articleId, article);
    if (!skuUuid) throw { statusCode: 404, message: 'Aucune image' };

    const img = await prisma.skuImage.findFirst({
      where: { id: String(imageId), sku_id: skuUuid },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable' };
    if (img.url) fileUploadService.deleteFileByPath(img.url);
    await prisma.skuImage.delete({ where: { id: img.id } });
  }
}

module.exports = new ArticleSkuImageService();
