const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check Article model fields
  const articles = await p.article.findMany({
    take: 3,
    select: {
      id: true, name_fr: true, name_ar: true,
      selling_price_ttc: true, selling_price_ht: true,
      vat_rate: true, status: true, is_published: true,
    },
  }).catch(() => null);
  console.log('=== ARTICLES ===');
  console.log(JSON.stringify(articles, null, 2));

  // Check SKU with article relation
  const skus = await p.sku.findMany({
    take: 3,
    include: {
      article: { select: { id: true, name_fr: true, selling_price_ttc: true, vat_rate: true } },
      images:  { take: 1, select: { image_path: true } },
    },
  }).catch(() => null);
  console.log('\n=== SKUS ===');
  console.log(JSON.stringify(skus, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
