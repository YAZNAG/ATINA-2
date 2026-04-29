const prisma = require('../../../config/database');
const fileUploadService = require('../../../services/fileUpload.service');

const FOLDER = 'articles';

class ArticleImageService {
  async addImages(articleId, files) {
    const article = await prisma.article.findFirst({ where: { id: Number(articleId), deleted_at: null } });
    if (!article) throw { statusCode: 404, message: 'Article introuvable' };
    if (!files?.images?.length) throw { statusCode: 400, message: 'Aucune image fournie' };

    const hasMain = await prisma.articleImage.count({ where: { article_id: Number(articleId), is_main: true, deleted_at: null } });
    const images = files.images.map((file, idx) => ({
      article_id: Number(articleId),
      image_path: `/uploads/${FOLDER}/${file.filename}`,
      is_main: hasMain === 0 && idx === 0,
      sort_order: idx,
    }));

    await prisma.articleImage.createMany({ data: images });
    return prisma.articleImage.findMany({ where: { article_id: Number(articleId), deleted_at: null }, orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }] });
  }

  async setMain(articleId, imageId) {
    await prisma.articleImage.updateMany({ where: { article_id: Number(articleId) }, data: { is_main: false } });
    return prisma.articleImage.update({ where: { id: Number(imageId) }, data: { is_main: true } });
  }

  async deleteImage(imageId) {
    const img = await prisma.articleImage.findUnique({ where: { id: Number(imageId) } });
    if (!img) throw { statusCode: 404, message: 'Image introuvable' };
    fileUploadService.deleteFileByPath(img.image_path);
    await prisma.articleImage.update({ where: { id: Number(imageId) }, data: { deleted_at: new Date() } });
  }
}

module.exports = new ArticleImageService();
