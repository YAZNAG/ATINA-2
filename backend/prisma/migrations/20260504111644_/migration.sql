/*
  Warnings:

  - You are about to drop the column `article_status_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `article_type_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `barcode` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `conservation_type_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `is_perishable` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `is_sellable` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `is_stockable` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `max_stock` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `min_stock` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `packaging_type_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_unit_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `reorder_stock` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `requires_batch_number` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `requires_expiry_date` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `sale_unit_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `short_name_ar` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `short_name_fr` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `tax_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `unit_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `volume` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `articles` table. All the data in the column will be lost.
  - You are about to alter the column `name_fr` on the `articles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `name_ar` on the `articles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to drop the column `image_base64` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `image_base64` on the `families` table. All the data in the column will be lost.
  - You are about to drop the column `image_base64` on the `sub_categories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku_code]` on the table `articles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ean13]` on the table `articles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku_uuid]` on the table `articles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `price` to the `articles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku_code` to the `articles` table without a default value. This is not possible if the table is not empty.
  - Made the column `family_id` on table `articles` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_article_status_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_article_type_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_conservation_type_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_family_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_packaging_type_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_purchase_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_sale_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_tax_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_unit_id_fkey";

-- DropIndex
DROP INDEX "articles_barcode_key";

-- DropIndex
DROP INDEX "articles_sku_key";

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "article_status_id",
DROP COLUMN "article_type_id",
DROP COLUMN "barcode",
DROP COLUMN "conservation_type_id",
DROP COLUMN "is_perishable",
DROP COLUMN "is_sellable",
DROP COLUMN "is_stockable",
DROP COLUMN "max_stock",
DROP COLUMN "min_stock",
DROP COLUMN "packaging_type_id",
DROP COLUMN "purchase_unit_id",
DROP COLUMN "reorder_stock",
DROP COLUMN "requires_batch_number",
DROP COLUMN "requires_expiry_date",
DROP COLUMN "sale_unit_id",
DROP COLUMN "short_name_ar",
DROP COLUMN "short_name_fr",
DROP COLUMN "sku",
DROP COLUMN "tax_id",
DROP COLUMN "unit_id",
DROP COLUMN "volume",
DROP COLUMN "weight",
ADD COLUMN     "coeff" DECIMAL(10,4) NOT NULL DEFAULT 1,
ADD COLUMN     "ean13" VARCHAR(13),
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "sku_code" VARCHAR(100) NOT NULL,
ADD COLUMN     "sku_uuid" UUID,
ADD COLUMN     "unit_purchase" VARCHAR(20) NOT NULL DEFAULT 'unit',
ADD COLUMN     "unit_sale" VARCHAR(20) NOT NULL DEFAULT 'unit',
ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
ADD COLUMN     "volume_ml" INTEGER,
ADD COLUMN     "weight_g" INTEGER,
ALTER COLUMN "name_fr" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "name_ar" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "family_id" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "description_ar" TEXT,
ADD COLUMN     "description_fr" TEXT;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "image_base64";

-- AlterTable
ALTER TABLE "families" DROP COLUMN "image_base64";

-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "updated_by" INTEGER;

-- AlterTable
ALTER TABLE "sub_categories" DROP COLUMN "image_base64";

-- CreateTable
CREATE TABLE "skus" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_images" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_fr" VARCHAR(255),
    "alt_ar" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_sku_code_key" ON "articles"("sku_code");

-- CreateIndex
CREATE UNIQUE INDEX "articles_ean13_key" ON "articles"("ean13");

-- CreateIndex
CREATE UNIQUE INDEX "articles_sku_uuid_key" ON "articles"("sku_uuid");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sku_uuid_fkey" FOREIGN KEY ("sku_uuid") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_images" ADD CONSTRAINT "sku_images_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
