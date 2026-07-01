const prisma = require('../../config/database');

async function getFaq() {
  const categories = await prisma.faqCategory.findMany({
    where:   { is_active: true, is_deleted: false },
    orderBy: { sort_order: 'asc' },
    include: {
      items: {
        where:   { is_active: true, is_deleted: false },
        orderBy: { sort_order: 'asc' },
        select:  { id: true, question_fr: true, answer_fr: true },
      },
    },
  });

  return categories
    .filter(c => c.items.length > 0)
    .map(c => ({
      id:       c.id,
      name_fr:  c.name_fr,
      icon:     c.icon,
      items:    c.items,
    }));
}

module.exports = { getFaq };