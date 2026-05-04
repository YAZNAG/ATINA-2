-- P0 customers: contraintes non exprimables dans Prisma 5.7 (CHECK, index unique partiel).
-- Exécuter après `npx prisma db push` (psql ou client SQL). Idempotent.

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_preferred_lang_check";
ALTER TABLE "customers" ADD CONSTRAINT "customers_preferred_lang_check"
  CHECK ("preferred_lang" IN ('fr', 'ar'));

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_wallet_balance_check";
ALTER TABLE "customers" ADD CONSTRAINT "customers_wallet_balance_check"
  CHECK ("wallet_balance" >= 0);

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_points_balance_check";
ALTER TABLE "customers" ADD CONSTRAINT "customers_points_balance_check"
  CHECK ("points_balance" >= 0);

DROP INDEX IF EXISTS "customers_phone_active_unique";
CREATE UNIQUE INDEX "customers_phone_active_unique" ON "customers" ("phone_country", "phone_number")
  WHERE "is_deleted" = false;
