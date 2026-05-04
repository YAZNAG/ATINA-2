const prisma = require('../../../config/database');
const fileUploadService = require('../../../services/fileUpload.service');
const { getArticleSkuImagePublicUrl } = require('../../../utils/fileStorage');
const { setArticleSkuUuid, getArticleSkuUuid } = require('../../../utils/articleSkuLink');

const ARTICLE_WHERE = { deleted_at: null, is_deleted: false };

/** La 1re image (tri `sort_order` croissant puis `id`) est l’image principale. */
async function syncPrimaryFromSortOrder(skuId) {
  const rows = await prisma.skuImage.findMany({
    where: { sku_id: skuId },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  });
  if (!rows.length) return;
  await prisma.skuImage.updateMany({ where: { sku_id: skuId }, data: { is_primary: false } });
  await prisma.skuImage.update({ where: { id: rows[0].id }, data: { is_primary: true } });
}

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
    const nextOrder = (agg._max.sort_order ?? 0) + 1;

    const rows = files.images.map((file, idx) => ({
      sku_id: skuId,
      url: getArticleSkuImagePublicUrl(articleId, file.filename),
      is_primary: false,
      sort_order: nextOrder + idx,
    }));

    await prisma.skuImage.createMany({ data: rows });
    await syncPrimaryFromSortOrder(skuId);
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

    const all = await prisma.skuImage.findMany({
      where: { sku_id: skuUuid },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    const rest = all.filter((x) => x.id !== img.id);
    const ordered = [img, ...rest];
    await prisma.$transaction(
      ordered.map((row, i) =>
        prisma.skuImage.update({
          where: { id: row.id },
          data: { sort_order: i + 1, is_primary: i === 0 },
        }),
      ),
    );

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
    await syncPrimaryFromSortOrder(skuUuid);
  }
}

module.exports = new ArticleSkuImageService();
