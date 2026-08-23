-- DropForeignKey
ALTER TABLE "article_images" DROP CONSTRAINT "article_images_article_id_fkey";

-- DropForeignKey
ALTER TABLE "article_reviews" DROP CONSTRAINT "article_reviews_article_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_article_status_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_article_type_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_category_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_conservation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_packaging_type_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_sku_family_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_sku_subfamily_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_sku_uuid_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_tax_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_unit_purchase_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_unit_sale_id_fkey";

-- DropForeignKey
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_article_id_fkey";

-- DropIndex
DROP INDEX "article_reviews_article_id_customer_id_key";

-- DropIndex
DROP INDEX "article_reviews_article_id_idx";

-- DropIndex
DROP INDEX "wishlists_customer_id_article_id_key";

-- AlterTable
ALTER TABLE "article_reviews" DROP COLUMN "article_id",
ADD COLUMN     "sku_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "sku_images" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "brand_id" INTEGER,
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "coeff" DECIMAL(10,4) NOT NULL DEFAULT 1,
ADD COLUMN     "conservation_type_id" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "description_ar" TEXT,
ADD COLUMN     "description_fr" TEXT,
ADD COLUMN     "ean13" VARCHAR(13),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name_ar" VARCHAR(255) NOT NULL,
ADD COLUMN     "name_fr" VARCHAR(255) NOT NULL,
ADD COLUMN     "packaging_type_id" INTEGER,
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "sku_code" VARCHAR(100) NOT NULL,
ADD COLUMN     "sku_family_id" UUID NOT NULL,
ADD COLUMN     "sku_subfamily_id" UUID,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN     "tax_id" INTEGER,
ADD COLUMN     "unit_purchase" VARCHAR(20) NOT NULL DEFAULT 'unit',
ADD COLUMN     "unit_purchase_id" INTEGER,
ADD COLUMN     "unit_sale" VARCHAR(20) NOT NULL DEFAULT 'unit',
ADD COLUMN     "unit_sale_id" INTEGER,
ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
ADD COLUMN     "volume_ml" INTEGER,
ADD COLUMN     "weight_g" INTEGER;

-- AlterTable
ALTER TABLE "wishlists" DROP COLUMN "article_id",
ADD COLUMN     "sku_id" UUID NOT NULL;

-- DropTable
DROP TABLE "article_images";

-- DropTable
DROP TABLE "article_statuses";

-- DropTable
DROP TABLE "article_types";

-- DropTable
DROP TABLE "articles";

-- CreateIndex
CREATE INDEX "article_reviews_sku_id_idx" ON "article_reviews"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_reviews_sku_id_customer_id_key" ON "article_reviews"("sku_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "skus_sku_code_key" ON "skus"("sku_code");

-- CreateIndex
CREATE UNIQUE INDEX "skus_ean13_key" ON "skus"("ean13");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_customer_id_sku_id_key" ON "wishlists"("customer_id", "sku_id");

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_conservation_type_id_fkey" FOREIGN KEY ("conservation_type_id") REFERENCES "conservation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_packaging_type_id_fkey" FOREIGN KEY ("packaging_type_id") REFERENCES "packaging_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_unit_purchase_id_fkey" FOREIGN KEY ("unit_purchase_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_unit_sale_id_fkey" FOREIGN KEY ("unit_sale_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_sku_family_id_fkey" FOREIGN KEY ("sku_family_id") REFERENCES "sku_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_sku_subfamily_id_fkey" FOREIGN KEY ("sku_subfamily_id") REFERENCES "sku_subfamilies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_reviews" ADD CONSTRAINT "article_reviews_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

