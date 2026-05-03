/**
 * Liaison article ↔ skus (sku_uuid) sans dépendre du client Prisma à jour
 * (si `prisma generate` n’a pas été relancé après ajout du champ au schema).
 */

async function setArticleSkuUuid(db, articleId, skuUuid) {
  const id = Number(articleId);
  await db.$executeRaw`
    UPDATE "articles"
    SET "sku_uuid" = ${String(skuUuid)}::uuid
    WHERE "id" = ${id}
  `;
}

/** Lit sku_uuid en SQL brut (fiable même si le client ne sélectionne pas la colonne). */
async function getArticleSkuUuid(db, articleId) {
  const id = Number(articleId);
  const rows = await db.$queryRaw`
    SELECT "sku_uuid" FROM "articles" WHERE "id" = ${id} LIMIT 1
  `;
  const u = rows[0]?.sku_uuid;
  return u != null ? String(u) : null;
}

module.exports = { setArticleSkuUuid, getArticleSkuUuid };
