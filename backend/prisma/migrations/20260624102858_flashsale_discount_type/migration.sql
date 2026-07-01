-- AlterTable
ALTER TABLE "flash_sales" ADD COLUMN     "discount_type" VARCHAR(20) NOT NULL DEFAULT 'fixed',
ADD COLUMN     "discount_value" DECIMAL(12,2);
