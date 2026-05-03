-- Synchronise la table `articles` avec schema.prisma (modèle Article réduit).
-- À exécuter une fois si `prisma db push` échoue à cause de données existantes.
-- Ensuite : npx prisma db push   (ou vérifie que tout est aligné)
--
-- Note : si l’erreur Prisma dit « The column `colonne` does not exist » avec PostgreSQL
-- en français, c’est souvent un mauvais parsing du message : la vraie colonne manquante
-- est listée dans le détail SQL PostgreSQL (souvent sku_code, is_deleted, price, …).

BEGIN;

-- Renommages depuis l’ancien schéma
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'sku'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'sku_code'
  ) THEN
    ALTER TABLE "articles" RENAME COLUMN "sku" TO "sku_code";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'barcode'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'ean13'
  ) THEN
    ALTER TABLE "articles" RENAME COLUMN "barcode" TO "ean13";
  END IF;
END $$;

-- Nouvelles colonnes (idempotent)
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "unit_sale" VARCHAR(20) NOT NULL DEFAULT 'unit';
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "unit_purchase" VARCHAR(20) NOT NULL DEFAULT 'unit';
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "coeff" DECIMAL(10,4) NOT NULL DEFAULT 1.0000;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20.00;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "weight_g" INTEGER;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "volume_ml" INTEGER;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "articles" SET "price" = 0 WHERE "price" IS NULL;
ALTER TABLE "articles" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "articles" ALTER COLUMN "price" SET DEFAULT 0;

-- family_id obligatoire : affecter une famille par défaut si besoin
UPDATE "articles" SET "family_id" = (SELECT id FROM "families" ORDER BY id LIMIT 1) WHERE "family_id" IS NULL;
ALTER TABLE "articles" ALTER COLUMN "family_id" SET NOT NULL;

-- Types texte
ALTER TABLE "articles" ALTER COLUMN "sku_code" TYPE VARCHAR(100);
ALTER TABLE "articles" ALTER COLUMN "ean13" TYPE VARCHAR(13);
ALTER TABLE "articles" ALTER COLUMN "name_fr" TYPE VARCHAR(255);
ALTER TABLE "articles" ALTER COLUMN "name_ar" TYPE VARCHAR(255);

-- Timestamptz (ignore erreur si déjà ok)
DO $$
BEGIN
  ALTER TABLE "articles" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6) USING "created_at"::timestamptz;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "articles" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(6) USING "updated_at"::timestamptz;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "articles" ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING "deleted_at"::timestamptz;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Contraintes FK obsolètes (noms par défaut Prisma — ignorer si absentes)
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_unit_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_packaging_type_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_conservation_type_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_article_type_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_article_status_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_tax_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_purchase_unit_id_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_sale_unit_id_fkey";

-- Suppression des anciennes colonnes (une fois les données migrées si besoin)
ALTER TABLE "articles" DROP COLUMN IF EXISTS "short_name_fr";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "short_name_ar";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "unit_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "packaging_type_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "conservation_type_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "article_type_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "article_status_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "tax_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "purchase_unit_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "sale_unit_id";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "weight";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "volume";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "min_stock";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "reorder_stock";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "max_stock";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "is_sellable";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "is_stockable";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "is_perishable";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "requires_expiry_date";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "requires_batch_number";

COMMIT;
