-- Table P0 `customers` (alignée Prisma) — à exécuter si `prisma db push` échoue ailleurs.
-- Idempotent : ne recrée pas si la table existe déjà.

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone_country" VARCHAR(5) NOT NULL DEFAULT '+212',
    "phone_number" VARCHAR(15) NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "name" VARCHAR(150) NOT NULL,
    "preferred_lang" VARCHAR(5) NOT NULL DEFAULT 'fr',
    "referral_code" VARCHAR(20) NOT NULL,
    "referred_by_id" UUID,
    "wallet_balance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "points_lifetime" INTEGER NOT NULL DEFAULT 0,
    "city" VARCHAR(100),
    "lat" DECIMAL(9, 6),
    "lng" DECIMAL(9, 6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_referral_code_key" ON "public"."customers" ("referral_code");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_referred_by_id_fkey'
    ) THEN
        ALTER TABLE "public"."customers"
            ADD CONSTRAINT "customers_referred_by_id_fkey"
            FOREIGN KEY ("referred_by_id") REFERENCES "public"."customers" ("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
