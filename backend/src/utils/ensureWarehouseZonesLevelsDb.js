/**
 * Crée `zones` et `levels` si absentes (équivalent migration 20260506000000_warehouse_zones_levels,
 * sans toucher à `locations` — évite de casser une BDD déjà migrée partiellement).
 */
let warehouseZonesLevelsEnsured = false;

async function ensureZonesLevelsTables(db) {
  if (warehouseZonesLevelsEnsured) return;

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "description_fr" TEXT,
    "description_ar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
)`);

  await db.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "zones_code_key" ON "zones"("code")',
  );

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
)`);

  await db.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "levels_code_key" ON "levels"("code")',
  );

  warehouseZonesLevelsEnsured = true;
}

module.exports = { ensureZonesLevelsTables };
