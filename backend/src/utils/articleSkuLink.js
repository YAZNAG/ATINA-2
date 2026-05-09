/**
 * Liaison article ↔ skus (sku_uuid) sans dépendre du client Prisma à jour
 * (si `prisma generate` n'a pas été relancé après ajout du champ au schema).
 */

let articlesPrismaColumnsEnsured = false;

/**
 * Colonnes `articles` attendues par Prisma (findMany lit toutes les scalaires + jointures).
 * Idempotent : ADD IF NOT EXISTS — utile si les migrations n’ont pas été appliquées sur une BDD existante.
 * Note : l’erreur PG en français « la colonne … » est parfois mal parsée par Prisma (« colonne »).
 */
async function ensureArticlesPrismaColumns(db) {
  if (articlesPrismaColumnsEnsured) return;
  const alters = [
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "description_fr" TEXT',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "description_ar" TEXT',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "category_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "sub_category_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "brand_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "article_type_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "article_status_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "conservation_type_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "tax_id" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "unit_sale" VARCHAR(20) NOT NULL DEFAULT \'unit\'',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "unit_purchase" VARCHAR(20) NOT NULL DEFAULT \'unit\'',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "coeff" DECIMAL(10,4) NOT NULL DEFAULT 1',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2)',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "weight_g" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "volume_ml" INTEGER',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6)',
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "sku_uuid" UUID',
  ];
  for (const sql of alters) {
    await db.$executeRawUnsafe(sql);
  }
  try {
    await db.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "articles_sku_uuid_key" ON "articles" ("sku_uuid") WHERE "sku_uuid" IS NOT NULL',
    );
  } catch (e) {
    console.warn('[articleSkuLink] index articles_sku_uuid_key:', e?.message ?? e);
  }
  try {
    await db.$executeRawUnsafe(
      'ALTER TABLE "articles" ADD CONSTRAINT "articles_sku_uuid_fkey" FOREIGN KEY ("sku_uuid") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE',
    );
  } catch (e) {
    if (e?.code !== '42710') {
      console.warn('[articleSkuLink] FK articles_sku_uuid_fkey:', e?.message ?? e);
    }
  }
  articlesPrismaColumnsEnsured = true;
}

/** @deprecated alias — gardé pour appels existants */
const ensureArticlesSkuUuidColumn = ensureArticlesPrismaColumns;

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

module.exports = {
  setArticleSkuUuid,
  getArticleSkuUuid,
  ensureArticlesPrismaColumns,
  ensureArticlesSkuUuidColumn,
};
