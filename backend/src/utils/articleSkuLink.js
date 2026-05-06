/**
 * Liaison article ↔ skus (sku_uuid) sans dépendre du client Prisma à jour
 * (si `prisma generate` n'a pas été relancé après ajout du champ au schema).
 */

/** Alignement BDD si le script SQL n'a pas encore été appliqué. */
async function ensureArticlesSkuUuidColumn(db) {
  await db.$executeRawUnsafe(
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "sku_uuid" UUID',
  );
  try {
    await db.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "articles_sku_uuid_key" ON "articles" ("sku_uuid") WHERE "sku_uuid" IS NOT NULL',
    );
  } catch (e) {
    console.warn('[articleSkuLink] index articles_sku_uuid_key:', e?.message ?? e);
  }
}

async function setArticleSkuUuid(db, articleId, skuUuid) {
  await ensureArticlesSkuUuidColumn(db);
  const id = Number(articleId);
  await db.$executeRaw`
    UPDATE "articles"
    SET "sku_uuid" = ${String(skuUuid)}::uuid
    WHERE "id" = ${id}
  `;
}

/** Lit sku_uuid en SQL brut (fiable même si le client ne sélectionne pas la colonne). */
async function getArticleSkuUuid(db, articleId) {
  await ensureArticlesSkuUuidColumn(db);
  const id = Number(articleId);
  const rows = await db.$queryRaw`
    SELECT "sku_uuid" FROM "articles" WHERE "id" = ${id} LIMIT 1
  `;
  const u = rows[0]?.sku_uuid;
  return u != null ? String(u) : null;
}

module.exports = { setArticleSkuUuid, getArticleSkuUuid };
