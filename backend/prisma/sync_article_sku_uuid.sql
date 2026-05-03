-- Ajoute la FK articles.sku_uuid → skus(id) pour la galerie sku_images.
BEGIN;

ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "sku_uuid" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "articles_sku_uuid_key" ON "articles" ("sku_uuid");
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_sku_uuid_fkey";
ALTER TABLE "articles"
  ADD CONSTRAINT "articles_sku_uuid_fkey"
  FOREIGN KEY ("sku_uuid") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
