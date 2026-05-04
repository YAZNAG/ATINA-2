-- Aligne la table `brands` avec le modèle Prisma `Brand` (descriptions optionnelles).
BEGIN;

ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "description_fr" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "logo" TEXT;

COMMIT;
