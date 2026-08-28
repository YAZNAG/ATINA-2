-- AlterTable
ALTER TABLE "delivery_slots" ADD COLUMN     "is_closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specific_date" DATE,
ALTER COLUMN "name_fr" DROP NOT NULL,
ALTER COLUMN "name_ar" DROP NOT NULL,
ALTER COLUMN "day_of_week" DROP NOT NULL,
ALTER COLUMN "slot_start" DROP NOT NULL,
ALTER COLUMN "slot_end" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "delivery_slots_node_id_day_of_week_idx" ON "delivery_slots"("node_id", "day_of_week");

-- CreateIndex
CREATE INDEX "delivery_slots_node_id_specific_date_idx" ON "delivery_slots"("node_id", "specific_date");
