-- Conformite classeur Atina Suivi 3108 : tables, colonnes, referentiels, permissions, triggers append-only.

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "city_id" UUID;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "city_id" UUID;

-- AlterTable
ALTER TABLE "delivery_slots" ADD COLUMN     "name_ar" VARCHAR(100),
ADD COLUMN     "name_fr" VARCHAR(100);

-- AlterTable
ALTER TABLE "gamification_prizes" ADD COLUMN     "coupon_min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "coupon_promo_type_id" UUID,
ADD COLUMN     "coupon_validity_days" SMALLINT NOT NULL DEFAULT 30,
ADD COLUMN     "pack_id" UUID;

-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "slot_selection_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "game_play_id" UUID,
ADD COLUMN     "is_points_exchange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "points_spent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assignment_source_id" UUID,
ADD COLUMN     "points_redeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slot_assigned_by" INTEGER;

-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "availability_updated_at" TIMESTAMPTZ(6),
ADD COLUMN     "estimated_restock_days" SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN     "is_available" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sold_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "collected_at" TIMESTAMPTZ(6),
ADD COLUMN     "collected_by" VARCHAR(150),
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "points_rules" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "is_combined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_gamification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "play_id" UUID,
ADD COLUMN     "referral_id" UUID;

-- AlterTable
ALTER TABLE "referral_config" ADD COLUMN     "promo_min_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promo_type_id" UUID,
ADD COLUMN     "promo_validity_days" SMALLINT NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contact_email" VARCHAR(150),
ADD COLUMN     "contact_name" VARCHAR(150),
ADD COLUMN     "contact_phone" VARCHAR(30),
ADD COLUMN     "lead_time_days" SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_terms" VARCHAR(150),
ADD COLUMN     "score" DECIMAL(3,1);

-- AlterTable
ALTER TABLE "tour_stops" ADD COLUMN     "arrived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "order_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "route_json" JSONB;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "check_type_id" UUID NOT NULL,
    "picking_session_id" UUID,
    "order_id" UUID,
    "result" VARCHAR(10) NOT NULL,
    "score" SMALLINT,
    "anomalies" TEXT,
    "notes" TEXT,
    "checked_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_prices" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "price_ht" DECIMAL(12,4) NOT NULL,
    "qty_min" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "qty_max" DECIMAL(12,3),
    "valid_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "po_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(50) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "expected_at" DATE,
    "received_at" TIMESTAMPTZ(6),
    "total_ht" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "qty_ordered" DECIMAL(12,3) NOT NULL,
    "qty_received" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit_price_ht" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_sessions" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(50) NOT NULL,
    "node_id" UUID NOT NULL,
    "zone_id" UUID,
    "category_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "created_by" INTEGER,
    "validated_by" INTEGER,
    "validated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_count_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "location_id" UUID,
    "qty_theoretical" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_counted" DECIMAL(12,3),
    "counted_at" TIMESTAMPTZ(6),
    "note" TEXT,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_exchange_skus" (
    "id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "max_qty_per_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "points_exchange_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_slot_preferences" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "preference_order" SMALLINT NOT NULL DEFAULT 1,
    "status_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_slot_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "quality_checks_node_id_created_at_idx" ON "quality_checks"("node_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "supplier_prices_supplier_id_idx" ON "supplier_prices"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_prices_sku_id_idx" ON "supplier_prices"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "po_statuses_code_key" ON "po_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_reference_key" ON "purchase_orders"("reference");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_node_id_idx" ON "purchase_orders"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_po_id_sku_id_key" ON "purchase_order_items"("po_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_sessions_reference_key" ON "stock_count_sessions"("reference");

-- CreateIndex
CREATE INDEX "stock_count_sessions_node_id_idx" ON "stock_count_sessions"("node_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_session_id_idx" ON "stock_count_lines"("session_id");

-- CreateIndex
CREATE INDEX "points_exchange_skus_node_id_idx" ON "points_exchange_skus"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_slot_preferences_order_id_slot_id_key" ON "order_slot_preferences"("order_id", "slot_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignment_source_id_fkey" FOREIGN KEY ("assignment_source_id") REFERENCES "slot_assignment_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_config" ADD CONSTRAINT "referral_config_promo_type_id_fkey" FOREIGN KEY ("promo_type_id") REFERENCES "promo_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_prizes" ADD CONSTRAINT "gamification_prizes_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification_prizes" ADD CONSTRAINT "gamification_prizes_coupon_promo_type_id_fkey" FOREIGN KEY ("coupon_promo_type_id") REFERENCES "promo_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_check_type_id_fkey" FOREIGN KEY ("check_type_id") REFERENCES "quality_check_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_picking_session_id_fkey" FOREIGN KEY ("picking_session_id") REFERENCES "picking_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "po_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "stock_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_exchange_skus" ADD CONSTRAINT "points_exchange_skus_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_exchange_skus" ADD CONSTRAINT "points_exchange_skus_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_slot_preferences" ADD CONSTRAINT "order_slot_preferences_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_slot_preferences" ADD CONSTRAINT "order_slot_preferences_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "delivery_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_slot_preferences" ADD CONSTRAINT "order_slot_preferences_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "order_slot_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────────────
-- Index partiel : une seule règle d'échange active par (node, SKU)
-- ────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "points_exchange_skus_node_sku_active_key"
  ON "points_exchange_skus" ("node_id", "sku_id") WHERE "is_deleted" = false;

-- ────────────────────────────────────────────────────────────────────
-- Tables append-only (classeur : stock_moves, points_txns, audit_logs)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION atina_forbid_mutation() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'Table %.% est append-only : % interdit', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_append_only ON "audit_logs";
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION atina_forbid_mutation();
DROP TRIGGER IF EXISTS stock_moves_append_only ON "stock_moves";
CREATE TRIGGER stock_moves_append_only BEFORE UPDATE OR DELETE ON "stock_moves"
  FOR EACH ROW EXECUTE FUNCTION atina_forbid_mutation();
DROP TRIGGER IF EXISTS points_transactions_append_only ON "points_transactions";
CREATE TRIGGER points_transactions_append_only BEFORE UPDATE OR DELETE ON "points_transactions"
  FOR EACH ROW EXECUTE FUNCTION atina_forbid_mutation();

-- ────────────────────────────────────────────────────────────────────
-- Référentiels (lookups) exigés par le classeur
-- ────────────────────────────────────────────────────────────────────
INSERT INTO "game_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'roulette', 'Roulette', 'عجلة الحظ'),
  (gen_random_uuid(), 'scratch_card', 'Carte à gratter', 'بطاقة الخدش')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "prize_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'points', 'Points', 'نقاط'),
  (gen_random_uuid(), 'coupon', 'Coupon', 'قسيمة'),
  (gen_random_uuid(), 'free_sku', 'Produit offert', 'منتج مجاني'),
  (gen_random_uuid(), 'free_pack', 'Pack offert', 'حزمة مجانية'),
  (gen_random_uuid(), 'no_prize', 'Perdu', 'لا جائزة')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "game_play_periods" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'lifetime', 'Une seule fois', 'مرة واحدة'),
  (gen_random_uuid(), 'daily', 'Par jour', 'يومي'),
  (gen_random_uuid(), 'weekly', 'Par semaine', 'أسبوعي'),
  (gen_random_uuid(), 'monthly', 'Par mois', 'شهري')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "unlock_conditions" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'first_order', 'Première commande', 'أول طلب'),
  (gen_random_uuid(), 'order_delivered', 'Commande livrée', 'طلب مسلَّم'),
  (gen_random_uuid(), 'signup', 'Inscription', 'التسجيل'),
  (gen_random_uuid(), 'app_login', 'Connexion à l''app', 'تسجيل الدخول')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "reward_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'points', 'Points', 'نقاط'),
  (gen_random_uuid(), 'promo_code', 'Code promo', 'رمز ترويجي')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "points_rule_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'per_spend', 'Par montant dépensé', 'حسب المبلغ'),
  (gen_random_uuid(), 'flat_bonus', 'Bonus fixe', 'مكافأة ثابتة'),
  (gen_random_uuid(), 'category_multiplier', 'Multiplicateur catégorie', 'مضاعف الفئة'),
  (gen_random_uuid(), 'first_order', 'Première commande', 'أول طلب')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "referral_statuses" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'pending', 'En attente', 'قيد الانتظار'),
  (gen_random_uuid(), 'validated', 'Validé', 'مؤكد'),
  (gen_random_uuid(), 'rejected', 'Rejeté', 'مرفوض'),
  (gen_random_uuid(), 'expired', 'Expiré', 'منتهي')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "promo_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'PERCENTAGE', 'Pourcentage', 'نسبة مئوية'),
  (gen_random_uuid(), 'FIXED', 'Montant fixe', 'مبلغ ثابت'),
  (gen_random_uuid(), 'FREE_SHIPPING', 'Livraison offerte', 'توصيل مجاني')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "quality_check_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'picking_accuracy', 'Exactitude de préparation', 'دقة التحضير'),
  (gen_random_uuid(), 'packaging', 'Emballage', 'التغليف'),
  (gen_random_uuid(), 'temperature', 'Chaîne du froid', 'سلسلة التبريد'),
  (gen_random_uuid(), 'expiry', 'Dates de péremption', 'تواريخ الصلاحية')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "slot_assignment_sources" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'system', 'Système', 'النظام'),
  (gen_random_uuid(), 'backoffice', 'Back-office', 'الإدارة'),
  (gen_random_uuid(), 'customer', 'Client', 'الزبون')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "order_slot_statuses" (id, code, name_fr, name_ar, color) VALUES
  (gen_random_uuid(), 'preferred', 'Souhaité', 'مفضل', '#3b82f6'),
  (gen_random_uuid(), 'confirmed', 'Confirmé', 'مؤكد', '#10b981'),
  (gen_random_uuid(), 'rejected', 'Rejeté', 'مرفوض', '#ef4444'),
  (gen_random_uuid(), 'expired', 'Expiré', 'منتهي', '#64748b')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "po_statuses" (id, code, name_fr, name_ar, color, sort_order) VALUES
  (gen_random_uuid(), 'draft', 'Brouillon', 'مسودة', '#64748b', 1),
  (gen_random_uuid(), 'sent', 'Envoyé', 'مرسل', '#3b82f6', 2),
  (gen_random_uuid(), 'in_transit', 'En transit', 'في الطريق', '#f59e0b', 3),
  (gen_random_uuid(), 'partially_received', 'Partiellement reçu', 'مستلم جزئيا', '#8b5cf6', 4),
  (gen_random_uuid(), 'received', 'Reçu', 'مستلم', '#10b981', 5),
  (gen_random_uuid(), 'cancelled', 'Annulé', 'ملغى', '#ef4444', 6)
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- Permissions des nouveaux modules, accordées aux rôles super admin
-- ────────────────────────────────────────────────────────────────────
INSERT INTO "permissions" (name, code, module, description, updated_at) VALUES
  ('Voir le reporting', 'reporting.view', 'reporting', 'KPI et distribution du stock', now()),
  ('Voir les fournisseurs', 'suppliers.view', 'suppliers', NULL, now()),
  ('Créer des fournisseurs', 'suppliers.create', 'suppliers', NULL, now()),
  ('Modifier des fournisseurs', 'suppliers.update', 'suppliers', NULL, now()),
  ('Supprimer des fournisseurs', 'suppliers.delete', 'suppliers', NULL, now()),
  ('Voir les bons de commande', 'purchase_orders.view', 'purchase_orders', NULL, now()),
  ('Créer des bons de commande', 'purchase_orders.create', 'purchase_orders', NULL, now()),
  ('Modifier des bons de commande', 'purchase_orders.update', 'purchase_orders', NULL, now()),
  ('Réceptionner des bons de commande', 'purchase_orders.receive', 'purchase_orders', NULL, now()),
  ('Voir les contrôles qualité', 'quality_checks.view', 'quality', NULL, now()),
  ('Créer des contrôles qualité', 'quality_checks.create', 'quality', NULL, now()),
  ('Voir les comptages', 'stock_counts.view', 'stock', NULL, now()),
  ('Gérer les comptages', 'stock_counts.manage', 'stock', NULL, now()),
  ('Voir les codes promo', 'coupons.view', 'offers', NULL, now()),
  ('Gérer les codes promo', 'coupons.manage', 'offers', NULL, now()),
  ('Voir les flash sales', 'flash_sales.view', 'offers', NULL, now()),
  ('Gérer les flash sales', 'flash_sales.manage', 'offers', NULL, now()),
  ('Voir la gamification', 'games.view', 'offers', NULL, now()),
  ('Gérer la gamification', 'games.manage', 'offers', NULL, now()),
  ('Voir les règles de points', 'points_rules.view', 'loyalty', NULL, now()),
  ('Gérer les règles de points', 'points_rules.manage', 'loyalty', NULL, now()),
  ('Voir le livre des points', 'points_ledger.view', 'loyalty', NULL, now()),
  ('Voir le parrainage', 'referrals.view', 'loyalty', NULL, now()),
  ('Gérer le parrainage', 'referrals.manage', 'loyalty', NULL, now()),
  ('Voir les échanges de points', 'points_exchange.view', 'loyalty', NULL, now()),
  ('Gérer les échanges de points', 'points_exchange.manage', 'loyalty', NULL, now()),
  ('Voir le journal d''audit', 'audit_logs.view', 'admin', NULL, now()),
  ('Voir le journal des notifications', 'notifications.view', 'admin', NULL, now()),
  ('Voir les paramètres applicatifs', 'app_configs.view', 'admin', NULL, now()),
  ('Gérer les paramètres applicatifs', 'app_configs.manage', 'admin', NULL, now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "role_permissions" (role_id, permission_id)
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('super_admin', 'superadmin')
  AND p.code IN (
    'reporting.view','suppliers.view','suppliers.create','suppliers.update','suppliers.delete',
    'purchase_orders.view','purchase_orders.create','purchase_orders.update','purchase_orders.receive',
    'quality_checks.view','quality_checks.create','stock_counts.view','stock_counts.manage',
    'coupons.view','coupons.manage','flash_sales.view','flash_sales.manage','games.view','games.manage',
    'points_rules.view','points_rules.manage','points_ledger.view','referrals.view','referrals.manage',
    'points_exchange.view','points_exchange.manage','audit_logs.view','notifications.view',
    'app_configs.view','app_configs.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
