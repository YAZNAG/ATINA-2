-- CreateTable zones
CREATE TABLE "zones" (
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
);

-- CreateTable levels
CREATE TABLE "levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");
CREATE UNIQUE INDEX "levels_code_key" ON "levels"("code");

-- Alter locations: replace string zone/level with UUID FKs
-- Drop old unique constraint
ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "locations_node_id_aisle_shelf_level_key";

-- Add new FK columns
ALTER TABLE "locations" ADD COLUMN "zone_id" UUID;
ALTER TABLE "locations" ADD COLUMN "level_id" UUID;

-- Drop old string columns (safe: table is empty in new installation)
ALTER TABLE "locations" DROP COLUMN IF EXISTS "zone";
ALTER TABLE "locations" DROP COLUMN IF EXISTS "level";

-- Make level_id required (assumes empty table)
ALTER TABLE "locations" ALTER COLUMN "level_id" SET NOT NULL;

-- Add FK constraints
ALTER TABLE "locations" ADD CONSTRAINT "locations_zone_id_fkey"
    FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "locations" ADD CONSTRAINT "locations_level_id_fkey"
    FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New unique constraint (node + aisle + shelf + level_id)
ALTER TABLE "locations" ADD CONSTRAINT "locations_node_id_aisle_shelf_level_id_key"
    UNIQUE ("node_id", "aisle", "shelf", "level_id");

-- sku_node_locations: is_active already in init migration; ensure correct default for is_primary_location
ALTER TABLE "sku_node_locations" ALTER COLUMN "is_primary_location" SET DEFAULT false;
