const prisma = require('../../../config/database');
const fileUploadService = require('../../../services/fileUpload.service');
const { getFilePath } = require('../../../utils/fileStorage');

const FOLDER = 'articles';

class ArticleImageService {
  async listByArticle(articleId) {
    const article = await prisma.article.findFirst({ where: { id: Number(articleId), deleted_at: null } });
    if (!article) throw { statusCode: 404, message: 'Article introuvable' };
    return prisma.articleImage.findMany({
      where: { article_id: Number(articleId), deleted_at: null },
      orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }],
    });
  }

  async addImages(articleId, files) {
    const article = await prisma.article.findFirst({ where: { id: Number(articleId), deleted_at: null } });
    if (!article) throw { statusCode: 404, message: 'Article introuvable' };
    if (!files?.images?.length) throw { statusCode: 400, message: 'Aucune image fournie' };

    const agg = await prisma.articleImage.aggregate({
      where: { article_id: Number(articleId), deleted_at: null },
      _max: { sort_order: true },
    });
    let nextOrder = (agg._max.sort_order ?? -1) + 1;

    const hasMain = await prisma.articleImage.count({
      where: { article_id: Number(articleId), is_main: true, deleted_at: null },
    });

    const rows = files.images.map((file, idx) => {
      const path = getFilePath(file, FOLDER);
      const row = {
        article_id: Number(articleId),
        image_path: path,
        is_main: hasMain === 0 && idx === 0,
        sort_order: nextOrder + idx,
      };
      return row;
    });

    await prisma.articleImage.createMany({ data: rows });
    return this.listByArticle(articleId);
  }

  async setMain(articleId, imageId) {
    const img = await prisma.articleImage.findFirst({
      where: { id: Number(imageId), article_id: Number(articleId), deleted_at: null },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable pour cet article' };

    await prisma.$transaction([
      prisma.articleImage.updateMany({
        where: { article_id: Number(articleId), deleted_at: null },
        data: { is_main: false },
      }),
      prisma.articleImage.update({ where: { id: img.id }, data: { is_main: true } }),
    ]);

    return prisma.articleImage.findFirst({ where: { id: img.id } });
  }

  async updateSortOrder(articleId, imageId, sort_order) {
    const order = Number(sort_order);
    if (Number.isNaN(order) || order < 0) {
      throw { statusCode: 400, message: 'Ordre d’affichage invalide' };
    }
    const img = await prisma.articleImage.findFirst({
      where: { id: Number(imageId), article_id: Number(articleId), deleted_at: null },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable pour cet article' };
    return prisma.articleImage.update({ where: { id: img.id }, data: { sort_order: order } });
  }

  async deleteImage(articleId, imageId) {
    const img = await prisma.articleImage.findFirst({
      where: { id: Number(imageId), article_id: Number(articleId), deleted_at: null },
    });
    if (!img) throw { statusCode: 404, message: 'Image introuvable' };
    fileUploadService.deleteFileByPath(img.image_path);
    await prisma.articleImage.update({ where: { id: img.id }, data: { deleted_at: new Date() } });
  }

  /** Appelé lors de la suppression d’un article : fichiers supprimés + suppression logique des lignes image. */
  async softDeleteAllForArticle(articleId) {
    const imgs = await prisma.articleImage.findMany({
      where: { article_id: Number(articleId), deleted_at: null },
    });
    for (const img of imgs) {
      fileUploadService.deleteFileByPath(img.image_path);
      await prisma.articleImage.update({
        where: { id: img.id },
        data: { deleted_at: new Date() },
      });
    }
  }
}

module.exports = new ArticleImageService();
