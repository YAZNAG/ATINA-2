-- CreateTable
CREATE TABLE "stock_operations" (
    "code" VARCHAR(10) NOT NULL,
    "name_fr" VARCHAR(50) NOT NULL,

    CONSTRAINT "stock_operations_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "move_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "operation" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "move_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "order_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "order_item_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_slot_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "order_slot_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "payment_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "tour_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "stop_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "picking_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_item_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "pick_item_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "referral_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_txn_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,

    CONSTRAINT "wallet_txn_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prize_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "prize_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "game_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_play_periods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "game_play_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unlock_conditions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "unlock_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "promo_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_rule_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "points_rule_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "reward_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "notification_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_check_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "quality_check_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_value_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "config_value_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costing_methods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "costing_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "delivery_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_assignment_sources" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "slot_assignment_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "phone_country" VARCHAR(5) NOT NULL DEFAULT '+212',
    "phone_number" VARCHAR(15) NOT NULL,
    "phone_verified_at" TIMESTAMPTZ(6),
    "name" VARCHAR(150) NOT NULL,
    "preferred_lang" VARCHAR(5) NOT NULL DEFAULT 'fr',
    "referral_code" VARCHAR(20) NOT NULL,
    "referred_by_id" UUID,
    "wallet_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "points_lifetime" INTEGER NOT NULL DEFAULT 0,
    "city" VARCHAR(100),
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" VARCHAR(100),
    "street_number" VARCHAR(20),
    "street_name" VARCHAR(255) NOT NULL,
    "quartier" VARCHAR(100),
    "city" VARCHAR(100) NOT NULL DEFAULT 'Rabat',
    "postal_code" VARCHAR(5),
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "delivery_notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "qty_physical" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_reserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_available" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_backordered" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_incoming" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_floating_cod" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "last_move_id" UUID,
    "last_counted_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selling_rules" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "is_backorderable" BOOLEAN NOT NULL DEFAULT true,
    "backorder_limit" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "backordered_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estimated_restock_days" SMALLINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "selling_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_rules" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "safety_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "economic_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(12,3),
    "lead_time_days" SMALLINT NOT NULL DEFAULT 1,
    "costing_method_id" UUID NOT NULL,
    "preferred_supplier_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reorder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "address_id" UUID,
    "tour_id" UUID,
    "promotion_id" UUID,
    "status_id" UUID NOT NULL,
    "delivery_type_id" UUID NOT NULL,
    "confirmed_slot_id" UUID,
    "slot_start" TIMESTAMPTZ(6),
    "slot_end" TIMESTAMPTZ(6),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MAD',
    "subtotal_ht" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "wallet_used" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_ttc" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cod_amount" DECIMAL(12,2),
    "cod_collected_at" TIMESTAMPTZ(6),
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancelled_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sku_id" UUID,
    "pack_id" UUID,
    "parent_item_id" UUID,
    "flash_sale_id" UUID,
    "status_id" UUID NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "unit_price_sold" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qty_backordered" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "node_id" UUID NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "payment_method_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MAD',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_configs" (
    "id" UUID NOT NULL,
    "node_id" UUID,
    "config_key" VARCHAR(100) NOT NULL,
    "config_value" TEXT NOT NULL,
    "value_type_id" UUID NOT NULL,
    "description" TEXT,
    "updated_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "aisle" VARCHAR(10) NOT NULL,
    "shelf" VARCHAR(10) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "zone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_node_locations" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "qty_physical" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "is_primary_location" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sku_node_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name_fr" VARCHAR(200) NOT NULL,
    "name_ar" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packs" (
    "id" UUID NOT NULL,
    "node_id" UUID,
    "name_fr" VARCHAR(255) NOT NULL,
    "name_ar" VARCHAR(255) NOT NULL,
    "description_fr" TEXT,
    "description_ar" TEXT,
    "image_url" TEXT,
    "total_price" DECIMAL(12,2) NOT NULL,
    "original_price" DECIMAL(12,2) NOT NULL,
    "discount_pct" DECIMAL(5,2),
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_items" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit_price_in_pack" DECIMAL(12,2) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "pack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_sales" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID,
    "pack_id" UUID,
    "name_fr" VARCHAR(255),
    "name_ar" VARCHAR(255),
    "image_url" TEXT,
    "flash_price" DECIMAL(12,2) NOT NULL,
    "stock_flash" INTEGER NOT NULL,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "max_qty_per_user" SMALLINT NOT NULL DEFAULT 1,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "node_id" UUID,
    "promo_type_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "uses_max" INTEGER,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "uses_per_user_max" SMALLINT NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_rules" (
    "id" UUID NOT NULL,
    "rule_type_id" UUID NOT NULL,
    "node_id" UUID,
    "category_id" UUID,
    "points_value" INTEGER NOT NULL,
    "per_mad_spent" DECIMAL(5,2),
    "min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_config" (
    "id" UUID NOT NULL,
    "node_id" UUID,
    "referrer_reward_type_id" UUID NOT NULL,
    "referrer_reward_value" DECIMAL(12,2) NOT NULL,
    "referee_reward_type_id" UUID NOT NULL,
    "referee_reward_value" DECIMAL(12,2) NOT NULL,
    "min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "max_referrals_per_user" SMALLINT,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referral_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "referee_id" UUID NOT NULL,
    "config_id" UUID,
    "status_id" UUID NOT NULL,
    "qualifying_order_id" UUID,
    "reward_amount" DECIMAL(12,2),
    "validated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_games" (
    "id" UUID NOT NULL,
    "node_id" UUID,
    "game_type_id" UUID NOT NULL,
    "play_period_id" UUID NOT NULL,
    "unlock_condition_id" UUID,
    "name_fr" VARCHAR(255) NOT NULL,
    "name_ar" VARCHAR(255) NOT NULL,
    "max_plays_per_user" SMALLINT NOT NULL DEFAULT 1,
    "unlock_min_amount" DECIMAL(12,2),
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gamification_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_prizes" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "prize_type_id" UUID NOT NULL,
    "name_fr" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "value" DECIMAL(12,2),
    "sku_id" UUID,
    "coupon_code_prefix" VARCHAR(20),
    "probability_weight" DECIMAL(8,4) NOT NULL,
    "stock_limit" INTEGER,
    "awarded_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gamification_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_plays" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "prize_id" UUID,
    "order_id" UUID,
    "result" VARCHAR(10) NOT NULL,
    "played_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "gamification_plays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_moves" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "move_type_id" UUID,
    "qty_delta" DECIMAL(12,3) NOT NULL,
    "reference" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" UUID NOT NULL,
    "node_id" UUID,
    "status_id" UUID NOT NULL,
    "planned_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_stops" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "order_id" UUID,
    "status_id" UUID NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tour_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "move_types_code_key" ON "move_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "order_statuses_code_key" ON "order_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_statuses_code_key" ON "order_item_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "order_slot_statuses_code_key" ON "order_slot_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_statuses_code_key" ON "payment_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tour_statuses_code_key" ON "tour_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "stop_statuses_code_key" ON "stop_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "picking_statuses_code_key" ON "picking_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pick_item_statuses_code_key" ON "pick_item_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_statuses_code_key" ON "referral_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_txn_types_code_key" ON "wallet_txn_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "prize_types_code_key" ON "prize_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "game_types_code_key" ON "game_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "game_play_periods_code_key" ON "game_play_periods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "unlock_conditions_code_key" ON "unlock_conditions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promo_types_code_key" ON "promo_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "points_rule_types_code_key" ON "points_rule_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reward_types_code_key" ON "reward_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_code_key" ON "notification_channels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "notification_statuses_code_key" ON "notification_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "quality_check_types_code_key" ON "quality_check_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "config_value_types_code_key" ON "config_value_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "costing_methods_code_key" ON "costing_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_types_code_key" ON "delivery_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "slot_assignment_sources_code_key" ON "slot_assignment_sources"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_referral_code_key" ON "customers"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_node_id_sku_id_key" ON "stock_levels"("node_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "selling_rules_node_id_sku_id_key" ON "selling_rules"("node_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "reorder_rules_node_id_sku_id_key" ON "reorder_rules"("node_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_configs_node_id_config_key_key" ON "app_configs"("node_id", "config_key");

-- CreateIndex
CREATE UNIQUE INDEX "locations_node_id_aisle_shelf_level_key" ON "locations"("node_id", "aisle", "shelf", "level");

-- CreateIndex
CREATE UNIQUE INDEX "sku_node_locations_sku_id_node_id_location_id_key" ON "sku_node_locations"("sku_id", "node_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrer_id_referee_id_key" ON "referrals"("referrer_id", "referee_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selling_rules" ADD CONSTRAINT "selling_rules_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selling_rules" ADD CONSTRAINT "selling_rules_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_costing_method_id_fkey" FOREIGN KEY ("costing_method_id") REFERENCES "costing_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "order_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_type_id_fkey" FOREIGN KEY ("delivery_type_id") REFERENCES "delivery_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_slot_id_fkey" FOREIGN KEY ("confirmed_slot_id") REFERENCES "delivery_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "order_item_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_flash_sale_id_fkey" FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "payment_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_configs" ADD CONSTRAINT "app_configs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_configs" ADD CONSTRAINT "app_configs_value_type_id_fkey" FOREIGN KEY ("value_type_id") REFERENCES "config_value_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_configs" ADD CONSTRAINT "app_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_node_locations" ADD CONSTRAINT "sku_node_locations_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_node_locations" ADD CONSTRAINT "sku_node_locations_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_node_locations" ADD CONSTRAINT "sku_node_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_promo_type_id_fkey" FOREIGN KEY ("promo_type_id") REFERENCES "promo_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_rules" ADD CONSTRAINT "points_rules_rule_type_id_fkey" FOREIGN KEY ("rule_type_id") REFERENCES "points_rule_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_rules" ADD CONSTRAINT "points_rules_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_config" ADD CONSTRAINT "referral_config_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_config" ADD CONSTRAINT "referral_config_referrer_reward_type_id_fkey" FOREIGN KEY ("referrer_reward_type_id") REFERENCES "reward_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_config" ADD CONSTRAINT "referral_config_referee_reward_type_id_fkey" FOREIGN KEY ("referee_reward_type_id") REFERENCES "reward_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_config" ADD CONSTRAINT "referral_config_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "referral_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "referral_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_qualifying_order_id_fkey" FOREIGN KEY ("qualifying_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_games" ADD CONSTRAINT "gamification_games_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_games" ADD CONSTRAINT "gamification_games_game_type_id_fkey" FOREIGN KEY ("game_type_id") REFERENCES "game_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_games" ADD CONSTRAINT "gamification_games_play_period_id_fkey" FOREIGN KEY ("play_period_id") REFERENCES "game_play_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_games" ADD CONSTRAINT "gamification_games_unlock_condition_id_fkey" FOREIGN KEY ("unlock_condition_id") REFERENCES "unlock_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_games" ADD CONSTRAINT "gamification_games_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_prizes" ADD CONSTRAINT "gamification_prizes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "gamification_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_prizes" ADD CONSTRAINT "gamification_prizes_prize_type_id_fkey" FOREIGN KEY ("prize_type_id") REFERENCES "prize_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_prizes" ADD CONSTRAINT "gamification_prizes_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_plays" ADD CONSTRAINT "gamification_plays_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_plays" ADD CONSTRAINT "gamification_plays_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "gamification_games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_plays" ADD CONSTRAINT "gamification_plays_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "gamification_prizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_plays" ADD CONSTRAINT "gamification_plays_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_move_type_id_fkey" FOREIGN KEY ("move_type_id") REFERENCES "move_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "tour_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_stops" ADD CONSTRAINT "tour_stops_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "stop_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
