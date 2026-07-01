-- DropIndex
DROP INDEX "cart_items_cart_id_sku_id_key";

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "pack_id" UUID;

-- CreateIndex
CREATE INDEX "cart_items_cart_id_sku_id_idx" ON "cart_items"("cart_id", "sku_id");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
