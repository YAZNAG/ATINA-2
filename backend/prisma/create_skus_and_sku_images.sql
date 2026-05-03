-- Tables skus + sku_images (si absentes après migration Prisma).
-- Compatible PostgreSQL 13+ (gen_random_uuid intégré).

CREATE TABLE IF NOT EXISTS "skus" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sku_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sku_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "alt_fr" VARCHAR(255),
  "alt_ar" VARCHAR(255),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sku_images_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sku_images_sku_id_fkey'
  ) THEN
    ALTER TABLE "sku_images"
      ADD CONSTRAINT "sku_images_sku_id_fkey"
      FOREIGN KEY ("sku_id") REFERENCES "skus"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sku_images_sku_id_idx" ON "sku_images"("sku_id");
