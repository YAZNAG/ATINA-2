/*
  Warnings:

  - The `operator_id` column on the `stock_moves` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "stock_moves" DROP COLUMN "operator_id",
ADD COLUMN     "operator_id" INTEGER;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
