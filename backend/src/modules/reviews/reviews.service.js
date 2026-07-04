const prisma = require('../../config/database');

const REVIEW_INCLUDE = {
  customer: { select: { id: true, name: true } },
  article:  { select: { id: true, name_fr: true, sku_code: true } },
};

async function getAll(query = {}) {
  const where = { is_deleted: false };
  if (query.article_id) where.article_id = Number(query.article_id);
  if (query.rating)     where.rating     = Number(query.rating);

  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.articleReview.findMany({ where, include: REVIEW_INCLUDE, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.articleReview.count({ where }),
  ]);

  return {
    data: items.map(r => ({
      id: r.id, article: r.article, customer: r.customer,
      rating: r.rating, comment: r.comment, created_at: r.created_at,
    })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

async function remove(id) {
  const existing = await prisma.articleReview.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Avis introuvable' };
  await prisma.articleReview.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date() },
  });
  return { id };
}

module.exports = { getAll, remove };