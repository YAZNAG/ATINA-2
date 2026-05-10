-- Add color column to order_statuses, order_item_statuses, order_slot_statuses

ALTER TABLE "order_statuses"
  ADD COLUMN IF NOT EXISTS "color" VARCHAR(20) NOT NULL DEFAULT 'gray';

ALTER TABLE "order_item_statuses"
  ADD COLUMN IF NOT EXISTS "color" VARCHAR(20) NOT NULL DEFAULT 'gray';

ALTER TABLE "order_slot_statuses"
  ADD COLUMN IF NOT EXISTS "color" VARCHAR(20) NOT NULL DEFAULT 'gray';
