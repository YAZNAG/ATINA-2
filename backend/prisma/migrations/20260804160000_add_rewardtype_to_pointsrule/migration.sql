-- AlterTable
ALTER TABLE "points_rules" ADD COLUMN "reward_type_id" UUID;

-- AddForeignKey
ALTER TABLE "points_rules" ADD CONSTRAINT "points_rules_reward_type_id_fkey"
  FOREIGN KEY ("reward_type_id") REFERENCES "reward_types"("id");