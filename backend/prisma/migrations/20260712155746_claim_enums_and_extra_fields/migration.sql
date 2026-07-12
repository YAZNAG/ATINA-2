/*
  Warnings:

  - The `status` column on the `claims` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `type` on the `claims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('MISSING_PRODUCT', 'DAMAGED_PRODUCT', 'WRONG_PRODUCT', 'REFUND_REQUEST', 'DELIVERY_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClaimPriority" AS ENUM ('NORMAL', 'URGENT');

-- AlterTable: convert `type` from varchar to enum using existing values
ALTER TABLE "claims"
  ALTER COLUMN "type" TYPE "ClaimType"
  USING ("type"::"ClaimType");

-- AlterTable: convert `status` from varchar to enum, keep default
ALTER TABLE "claims"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "claims"
  ALTER COLUMN "status" TYPE "ClaimStatus"
  USING ("status"::"ClaimStatus");

ALTER TABLE "claims"
  ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable: add new columns
ALTER TABLE "claims"
  ADD COLUMN "priority" "ClaimPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "attachment_url" VARCHAR(500),
  ADD COLUMN "contact_phone" VARCHAR(30);


