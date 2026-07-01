const prisma = require('../../config/database');

//categories
async function getAllCategories(query = {}) {
  const where = { is_deleted: false };
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;

  const categories = await prisma.faqCategory.findMany({
    where,
    orderBy: { sort_order: 'asc' },
    include: { _count: { select: { items: { where: { is_deleted: false } } } } },
  });

  return categories.map(c => ({
    id: c.id, name_fr: c.name_fr, icon: c.icon,
    sort_order: c.sort_order, is_active: c.is_active,
    items_count: c._count.items,
  }));
}

async function createCategory(body) {
  if (!body.name_fr) throw { statusCode: 400, message: 'Nom de catégorie requis' };
  const created = await prisma.faqCategory.create({
    data: {
      name_fr:    body.name_fr,
      icon:       body.icon ?? null,
      sort_order: Number(body.sort_order ?? 0),
      is_active:  body.is_active !== undefined ? !!body.is_active : true,
    },
  });
  return created;
}

async function updateCategory(id, body) {
  const existing = await prisma.faqCategory.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Catégorie introuvable' };

  const data = {};
  if (body.name_fr    !== undefined) data.name_fr    = body.name_fr;
  if (body.icon       !== undefined) data.icon       = body.icon;
  if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order);
  if (body.is_active  !== undefined) data.is_active  = !!body.is_active;

  return prisma.faqCategory.update({ where: { id }, data });
}

async function removeCategory(id) {
  const existing = await prisma.faqCategory.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Catégorie introuvable' };

  await prisma.$transaction([
    prisma.faqItem.updateMany({
      where: { category_id: id, is_deleted: false },
      data:  { is_deleted: true, deleted_at: new Date() },
    }),
    prisma.faqCategory.update({
      where: { id },
      data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
    }),
  ]);
  return { id };
}

//questions+reponses
async function getAllItems(query = {}) {
  const where = { is_deleted: false };
  if (query.category_id) where.category_id = query.category_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;

  const items = await prisma.faqItem.findMany({
    where,
    orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }],
    include: { category: { select: { id: true, name_fr: true } } },
  });

  return items.map(i => ({
    id: i.id, category_id: i.category_id, category_name: i.category?.name_fr,
    question_fr: i.question_fr, answer_fr: i.answer_fr,
    sort_order: i.sort_order, is_active: i.is_active,
  }));
}

async function getItemById(id) {
  const item = await prisma.faqItem.findFirst({
    where: { id, is_deleted: false },
    include: { category: { select: { id: true, name_fr: true } } },
  });
  if (!item) throw { statusCode: 404, message: 'Question introuvable' };
  return item;
}

async function createItem(body) {
  if (!body.category_id) throw { statusCode: 400, message: 'category_id requis' };
  if (!body.question_fr) throw { statusCode: 400, message: 'Question requise' };
  if (!body.answer_fr)   throw { statusCode: 400, message: 'Réponse requise' };

  // Vérifie que la catégorie existe
  const cat = await prisma.faqCategory.findFirst({ where: { id: body.category_id, is_deleted: false } });
  if (!cat) throw { statusCode: 404, message: 'Catégorie introuvable' };

  return prisma.faqItem.create({
    data: {
      category_id: body.category_id,
      question_fr: body.question_fr,
      answer_fr:   body.answer_fr,
      sort_order:  Number(body.sort_order ?? 0),
      is_active:   body.is_active !== undefined ? !!body.is_active : true,
    },
  });
}

async function updateItem(id, body) {
  const existing = await prisma.faqItem.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Question introuvable' };

  const data = {};
  if (body.category_id !== undefined) data.category_id = body.category_id;
  if (body.question_fr !== undefined) data.question_fr = body.question_fr;
  if (body.answer_fr   !== undefined) data.answer_fr   = body.answer_fr;
  if (body.sort_order  !== undefined) data.sort_order  = Number(body.sort_order);
  if (body.is_active   !== undefined) data.is_active   = !!body.is_active;

  return prisma.faqItem.update({ where: { id }, data });
}

async function removeItem(id) {
  const existing = await prisma.faqItem.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw { statusCode: 404, message: 'Question introuvable' };

  await prisma.faqItem.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date(), is_active: false },
  });
  return { id };
}

module.exports = {
  getAllCategories, createCategory, updateCategory, removeCategory,
  getAllItems, getItemById, createItem, updateItem, removeItem,
};