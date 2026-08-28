-- DropForeignKey
ALTER TABLE "cities" DROP CONSTRAINT "cities_province_id_fkey";

-- DropForeignKey
ALTER TABLE "nodes" DROP CONSTRAINT "nodes_province_id_fkey";

-- DropForeignKey
ALTER TABLE "provinces" DROP CONSTRAINT "provinces_region_id_fkey";

-- AlterTable
ALTER TABLE "cities" DROP COLUMN "province_id",
ADD COLUMN     "region_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "nodes" DROP COLUMN "province_id";

-- DropTable
DROP TABLE "provinces";

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

