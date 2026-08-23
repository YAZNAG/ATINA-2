/*
  Warnings:

  - You are about to drop the column `family_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `sub_category_id` on the `articles` table. All the data in the column will be lost.
  - The `category_id` column on the `articles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `description_ar` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `description_fr` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `family_id` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `icon_path` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `image_path` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `categories` table. All the data in the column will be lost.
  - You are about to alter the column `name_fr` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `name_ar` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(150)`.
  - You are about to alter the column `code` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `sort_order` on the `categories` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - The `category_id` column on the `flash_sales` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `families` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sub_categories` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `sku_family_id` to the `articles` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_category_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_family_id_fkey";

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_sub_category_id_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_family_id_fkey";

-- DropForeignKey
ALTER TABLE "flash_sales" DROP CONSTRAINT "flash_sales_category_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_categories" DROP CONSTRAINT "sub_categories_category_id_fkey";

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "family_id",
DROP COLUMN "sub_category_id",
ADD COLUMN     "sku_family_id" UUID NOT NULL,
ADD COLUMN     "sku_subfamily_id" UUID,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" UUID;

-- AlterTable
ALTER TABLE "categories" DROP CONSTRAINT "categories_pkey",
DROP COLUMN "description_ar",
DROP COLUMN "description_fr",
DROP COLUMN "family_id",
DROP COLUMN "icon_path",
DROP COLUMN "image_path",
DROP COLUMN "status",
ADD COLUMN     "gpc_code" VARCHAR(20),
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "name_fr" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "name_ar" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "code" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "sort_order" SET DATA TYPE SMALLINT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "flash_sales" DROP COLUMN "category_id",
ADD COLUMN     "category_id" UUID;

-- DropTable
DROP TABLE "families";

-- DropTable
DROP TABLE "sub_categories";

-- CreateTable
CREATE TABLE "sku_families" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_subfamilies" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "family_id" UUID NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_subfamilies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sku_families_code_key" ON "sku_families"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sku_subfamilies_code_key" ON "sku_subfamilies"("code");

-- AddForeignKey
ALTER TABLE "sku_subfamilies" ADD CONSTRAINT "sku_subfamilies_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "sku_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sku_family_id_fkey" FOREIGN KEY ("sku_family_id") REFERENCES "sku_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sku_subfamily_id_fkey" FOREIGN KEY ("sku_subfamily_id") REFERENCES "sku_subfamilies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_rules" ADD CONSTRAINT "points_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
