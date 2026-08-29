/*
  Warnings:

  - You are about to drop the column `day_of_week` on the `delivery_slots` table. All the data in the column will be lost.
  - You are about to drop the column `is_closed` on the `delivery_slots` table. All the data in the column will be lost.
  - You are about to drop the column `name_ar` on the `delivery_slots` table. All the data in the column will be lost.
  - You are about to drop the column `name_fr` on the `delivery_slots` table. All the data in the column will be lost.
  - Made the column `slot_start` on table `delivery_slots` required. This step will fail if there are existing NULL values in that column.
  - Made the column `slot_end` on table `delivery_slots` required. This step will fail if there are existing NULL values in that column.
  - Made the column `max_orders` on table `delivery_slots` required. This step will fail if there are existing NULL values in that column.
  - Made the column `specific_date` on table `delivery_slots` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "delivery_slots_node_id_day_of_week_idx";

-- AlterTable
ALTER TABLE "delivery_slots" DROP COLUMN "day_of_week",
DROP COLUMN "is_closed",
DROP COLUMN "name_ar",
DROP COLUMN "name_fr",
ALTER COLUMN "slot_start" SET NOT NULL,
ALTER COLUMN "slot_end" SET NOT NULL,
ALTER COLUMN "max_orders" SET NOT NULL,
ALTER COLUMN "specific_date" SET NOT NULL;
