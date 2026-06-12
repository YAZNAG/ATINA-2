/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "article_status_id" INTEGER,
ADD COLUMN     "article_type_id" INTEGER,
ADD COLUMN     "conservation_type_id" INTEGER,
ADD COLUMN     "tax_id" INTEGER;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "levels" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "move_types" ADD COLUMN     "color" VARCHAR(20);

-- AlterTable
ALTER TABLE "node_types" ADD COLUMN     "color_badge" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "action" VARCHAR(50),
ADD COLUMN     "name_ar" VARCHAR(150),
ADD COLUMN     "name_fr" VARCHAR(150);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name_ar" VARCHAR(100),
ADD COLUMN     "name_fr" VARCHAR(100);

-- AlterTable
ALTER TABLE "stock_moves" ADD COLUMN     "lot_id" UUID,
ADD COLUMN     "operator_id" UUID,
ADD COLUMN     "order_id" UUID,
ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "stock_operations" ADD COLUMN     "name_ar" VARCHAR(50) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "tour_stops" ADD COLUMN     "amount_collected" DECIMAL(12,2),
ADD COLUMN     "cod_collected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delivered_at" TIMESTAMPTZ(6),
ADD COLUMN     "driver_notes" TEXT,
ADD COLUMN     "failure_reason" VARCHAR(100);

-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "date" VARCHAR(10),
ADD COLUMN     "driver_id" UUID,
ADD COLUMN     "slot_end" VARCHAR(5),
ADD COLUMN     "slot_start" VARCHAR(5),
ADD COLUMN     "zone" VARCHAR(100);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_login_at" TIMESTAMPTZ(6),
ADD COLUMN     "otp_code" VARCHAR(10),
ADD COLUMN     "otp_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "phone_country" VARCHAR(5) DEFAULT '+212',
ADD COLUMN     "phone_number" VARCHAR(15),
ADD COLUMN     "phone_verified_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "zones" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "backoffice_admins" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "node_id" UUID,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backoffice_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickers" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "phone_country" VARCHAR(5) NOT NULL DEFAULT '+212',
    "phone_number" VARCHAR(15) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_sessions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "picker_id" UUID,
    "status_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "error_count" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "picking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_session_items" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "location_id" UUID,
    "status_id" UUID NOT NULL,
    "qty_expected" DECIMAL(10,3) NOT NULL,
    "qty_picked" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "scanned_ean" VARCHAR(13),
    "substitute_sku_id" UUID,
    "picked_at" TIMESTAMPTZ(6),

    CONSTRAINT "picking_session_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "phone_country" VARCHAR(5) NOT NULL DEFAULT '+212',
    "phone_number" VARCHAR(15) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "vehicle_type" VARCHAR(50),
    "vehicle_plate" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "is_sellable" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "scope" VARCHAR(20),
    "color" VARCHAR(20),
    "description_fr" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "description_fr" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_gap_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "description_fr" VARCHAR(255),
    "color" VARCHAR(20),
    "impact_stock" VARCHAR(10) NOT NULL,
    "requires_validation" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_gap_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_threshold_rules" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "stock_minimum" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_alert_threshold" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_maximum" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorder_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "auto_restock_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_threshold_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_histories" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "changed_by" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "qty_initial" DECIMAL(12,3) NOT NULL,
    "qty_remaining" DECIMAL(12,3) NOT NULL,
    "cost_unit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "lot_number" VARCHAR(100),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" DATE,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "txn_type_id" UUID NOT NULL,
    "order_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_before" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "reference" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "channel_id" UUID,
    "event_code" VARCHAR(100) NOT NULL,
    "title_fr" VARCHAR(255),
    "body_fr" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backoffice_admins_user_id_key" ON "backoffice_admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_statuses_code_key" ON "stock_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_types_code_key" ON "inventory_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_statuses_code_key" ON "inventory_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_gap_types_code_key" ON "inventory_gap_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_threshold_rules_node_id_sku_id_key" ON "stock_threshold_rules"("node_id", "sku_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_customer_id_idx" ON "wallet_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "notifications_customer_id_idx" ON "notifications"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- AddForeignKey
ALTER TABLE "backoffice_admins" ADD CONSTRAINT "backoffice_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickers" ADD CONSTRAINT "pickers_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_sessions" ADD CONSTRAINT "picking_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_sessions" ADD CONSTRAINT "picking_sessions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_sessions" ADD CONSTRAINT "picking_sessions_picker_id_fkey" FOREIGN KEY ("picker_id") REFERENCES "pickers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_sessions" ADD CONSTRAINT "picking_sessions_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "picking_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_session_items" ADD CONSTRAINT "picking_session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "picking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_session_items" ADD CONSTRAINT "picking_session_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_session_items" ADD CONSTRAINT "picking_session_items_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "pick_item_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_session_items" ADD CONSTRAINT "picking_session_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_session_items" ADD CONSTRAINT "picking_session_items_substitute_sku_id_fkey" FOREIGN KEY ("substitute_sku_id") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_article_type_id_fkey" FOREIGN KEY ("article_type_id") REFERENCES "article_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_article_status_id_fkey" FOREIGN KEY ("article_status_id") REFERENCES "article_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_conservation_type_id_fkey" FOREIGN KEY ("conservation_type_id") REFERENCES "conservation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_tax_id_fkey" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_threshold_rules" ADD CONSTRAINT "stock_threshold_rules_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_threshold_rules" ADD CONSTRAINT "stock_threshold_rules_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_histories" ADD CONSTRAINT "order_histories_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_histories" ADD CONSTRAINT "order_histories_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "order_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_txn_type_id_fkey" FOREIGN KEY ("txn_type_id") REFERENCES "wallet_txn_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "notification_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
