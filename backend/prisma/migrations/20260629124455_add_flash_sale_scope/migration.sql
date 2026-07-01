-- AlterTable
ALTER TABLE "flash_sales" ADD COLUMN     "brand_id" INTEGER,
ADD COLUMN     "category_id" INTEGER,
ALTER COLUMN "flash_price" DROP NOT NULL,
ALTER COLUMN "stock_flash" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
