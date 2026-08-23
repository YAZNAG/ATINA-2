-- AlterTable
ALTER TABLE "sku_families" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sort_order" SMALLINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sku_subfamilies" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sort_order" SMALLINT NOT NULL DEFAULT 0;
