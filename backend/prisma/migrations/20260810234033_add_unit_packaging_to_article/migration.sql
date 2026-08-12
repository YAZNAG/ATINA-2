-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "packaging_type_id" INTEGER,
ADD COLUMN     "unit_purchase_id" INTEGER,
ADD COLUMN     "unit_sale_id" INTEGER;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_unit_purchase_id_fkey" FOREIGN KEY ("unit_purchase_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_unit_sale_id_fkey" FOREIGN KEY ("unit_sale_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_packaging_type_id_fkey" FOREIGN KEY ("packaging_type_id") REFERENCES "packaging_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
