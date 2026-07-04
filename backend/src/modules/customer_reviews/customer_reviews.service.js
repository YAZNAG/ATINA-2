const prisma = require('../../config/database');

const REVIEW_INCLUDE = {
  customer: { select: { id: true, name: true, avatar_url: true } },
};

function formatReview(r) {
  return {
    id:          r.id,
    article_id:  r.article_id,
    customer_id: r.customer_id,
    customer:    r.customer ?? null,
    rating:      r.rating,
    comment:     r.comment ?? null,
    created_at:  r.created_at,
    updated_at:  r.updated_at,
  };
}

//lister les avis d'un article (lecture publique)
async function listByArticle(article_id, query = {}) {
  const page  = Math.max(1, parseInt(query.page  ?? '1', 10));
  const limit = Math.max(1, parseInt(query.limit ?? '10', 10));
  const skip  = (page - 1) * limit;

  const where = { article_id: Number(article_id), is_deleted: false };

  const [items, total] = await Promise.all([
    prisma.articleReview.findMany({
      where, include: REVIEW_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip, take: limit,
    }),
    prisma.articleReview.count({ where }),
  ]);

  // Calcul de la note moyenne
  const agg = await prisma.articleReview.aggregate({
    where,
    _avg:   { rating: true },
    _count: { rating: true },
  });

  return {
    data: items.map(formatReview),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
    stats: {
      average_rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      review_count:   agg._count.rating,
    },
  };
}

// creer un avis
async function createReview(customerId, article_id, body) {
  const { rating, comment } = body;

  if (!article_id)               throw { statusCode: 400, message: 'article_id requis' };
  if (!rating || rating < 1 || rating > 5)
    throw { statusCode: 400, message: 'Note invalide (1-5)' };

  // Vérifie que l'article existe
  const article = await prisma.article.findFirst({
    where: { id: Number(article_id), is_deleted: false },
  });
  if (!article) throw { statusCode: 404, message: 'Article introuvable' };

  // verifie qu'il n'a pas deja laiss un avis
  const existing = await prisma.articleReview.findUnique({
    where: { article_id_customer_id: { article_id: Number(article_id), customer_id: customerId } },
  });
  if (existing && !existing.is_deleted)
    throw { statusCode: 409, message: 'Vous avez déjà laissé un avis sur cet article' };

  if (existing && existing.is_deleted) {
    const updated = await prisma.articleReview.update({
      where: { id: existing.id },
      data:  { rating: Number(rating), comment: comment ?? null, is_deleted: false, deleted_at: null },
      include: REVIEW_INCLUDE,
    });
    return formatReview(updated);
  }

  const created = await prisma.articleReview.create({
    data: {
      article_id:  Number(article_id),
      customer_id: customerId,
      rating:      Number(rating),
      comment:     comment ?? null,
    },
    include: REVIEW_INCLUDE,
  });
  return formatReview(created);
}

// modifier son avis 
async function updateReview(customerId, reviewId, body) {
  const existing = await prisma.articleReview.findFirst({
    where: { id: reviewId, customer_id: customerId, is_deleted: false },
  });
  if (!existing) throw { statusCode: 404, message: 'Avis introuvable' };

  const data = {};
  if (body.rating !== undefined) {
    const r = Number(body.rating);
    if (r < 1 || r > 5) throw { statusCode: 400, message: 'Note invalide (1-5)' };
    data.rating = r;
  }
  if (body.comment !== undefined) data.comment = body.comment ?? null;

  const updated = await prisma.articleReview.update({
    where: { id: reviewId }, data, include: REVIEW_INCLUDE,
  });
  return formatReview(updated);
}

// supprimer son avis 
async function deleteReview(customerId, reviewId) {
  const existing = await prisma.articleReview.findFirst({
    where: { id: reviewId, customer_id: customerId, is_deleted: false },
  });
  if (!existing) throw { statusCode: 404, message: 'Avis introuvable' };

  await prisma.articleReview.update({
    where: { id: reviewId },
    data:  { is_deleted: true, deleted_at: new Date() },
  });
  return { id: reviewId };
}

async function getMyReview(customerId, article_id) {
  const review = await prisma.articleReview.findUnique({
    where: {
      article_id_customer_id: {
        article_id: Number(article_id),
        customer_id: customerId,
      },
    },
    include: REVIEW_INCLUDE,
  });
  if (!review || review.is_deleted) return null;
  return formatReview(review);
}

module.exports = { listByArticle, createReview, updateReview, deleteReview, getMyReview };