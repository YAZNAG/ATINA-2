ALTER TABLE "points_rules" DROP CONSTRAINT "points_rules_reward_type_id_fkey";
ALTER TABLE "points_rules" ADD CONSTRAINT "points_rules_reward_type_id_fkey"
  FOREIGN KEY ("reward_type_id") REFERENCES "reward_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;