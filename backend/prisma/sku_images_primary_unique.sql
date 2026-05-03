-- À exécuter une fois après création des tables (ex. `npx prisma db push`).
-- UNIQUE (sku_id) WHERE is_primary = TRUE : au plus une image principale par SKU.
CREATE UNIQUE INDEX IF NOT EXISTS "sku_images_one_primary_per_sku"
  ON "sku_images" ("sku_id")
  WHERE "is_primary" = true;
