-- Conformite Schema_V3 (vague 2) : livre des points, statuts SKU, CUMP, tracabilite stock, villes, lots de jeux, notifications, roles.

-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "sort_order" SMALLINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "role_id" INTEGER;

-- AlterTable
ALTER TABLE "gamification_prizes" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "body_ar" TEXT,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "read_at" TIMESTAMPTZ(6),
ADD COLUMN     "status_id" UUID,
ADD COLUMN     "title_ar" VARCHAR(255);

-- AlterTable
ALTER TABLE "order_slot_preferences" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "pickers" ADD COLUMN     "role_id" INTEGER;

-- AlterTable
ALTER TABLE "po_statuses" ADD COLUMN     "is_terminal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "points_transactions" ADD COLUMN     "game_play_id" UUID,
ADD COLUMN     "points_rule_id" UUID,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "referral_id" UUID,
ADD COLUMN     "txn_type_id" UUID;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "ordered_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "status_id" UUID;

-- AlterTable
ALTER TABLE "stock_lots" ADD COLUMN     "location_id" UUID,
ADD COLUMN     "po_item_id" UUID;

-- AlterTable
ALTER TABLE "stock_moves" ADD COLUMN     "location_id" UUID,
ADD COLUMN     "po_item_id" UUID;

-- CreateTable
CREATE TABLE "points_txn_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,

    CONSTRAINT "points_txn_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_statuses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "sku_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_cost_snapshots" (
    "id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "cump" DECIMAL(12,4) NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_by_move_id" UUID,

    CONSTRAINT "sku_cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "points_txn_types_code_key" ON "points_txn_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sku_statuses_code_key" ON "sku_statuses"("code");

-- CreateIndex
CREATE INDEX "sku_cost_snapshots_sku_id_node_id_computed_at_idx" ON "sku_cost_snapshots"("sku_id", "node_id", "computed_at" DESC);

-- AddForeignKey
ALTER TABLE "pickers" ADD CONSTRAINT "pickers_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "sku_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_txn_type_id_fkey" FOREIGN KEY ("txn_type_id") REFERENCES "points_txn_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_points_rule_id_fkey" FOREIGN KEY ("points_rule_id") REFERENCES "points_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_game_play_id_fkey" FOREIGN KEY ("game_play_id") REFERENCES "gamification_plays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "notification_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_cost_snapshots" ADD CONSTRAINT "sku_cost_snapshots_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_cost_snapshots" ADD CONSTRAINT "sku_cost_snapshots_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_cost_snapshots" ADD CONSTRAINT "sku_cost_snapshots_triggered_by_move_id_fkey" FOREIGN KEY ("triggered_by_move_id") REFERENCES "stock_moves"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────────────
-- Référentiels
-- ────────────────────────────────────────────────────────────────────
INSERT INTO "points_txn_types" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'order_payment',     'Gain sur commande',       'نقاط الطلب'),
  (gen_random_uuid(), 'refund',            'Remboursement',           'استرجاع'),
  (gen_random_uuid(), 'referral_reward',   'Récompense parrainage',   'مكافأة الإحالة'),
  (gen_random_uuid(), 'promo_credit',      'Crédit promotionnel',     'رصيد ترويجي'),
  (gen_random_uuid(), 'prize_award',       'Gain de jeu',             'جائزة لعبة'),
  (gen_random_uuid(), 'sku_exchange',      'Échange contre produit',  'استبدال بمنتج'),
  (gen_random_uuid(), 'exchange_revert',   'Annulation d''échange',   'إلغاء الاستبدال'),
  (gen_random_uuid(), 'manual_adjustment', 'Ajustement manuel',       'تعديل يدوي')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "sku_statuses" (id, code, name_fr, name_ar, sort_order) VALUES
  (gen_random_uuid(), 'draft',        'Brouillon',    'مسودة',    1),
  (gen_random_uuid(), 'active',       'Actif',        'نشط',      2),
  (gen_random_uuid(), 'inactive',     'Inactif',      'غير نشط',  3),
  (gen_random_uuid(), 'discontinued', 'Arrêté',       'متوقف',    4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "notification_statuses" (id, code, name_fr, name_ar) VALUES
  (gen_random_uuid(), 'pending',   'En attente', 'قيد الانتظار'),
  (gen_random_uuid(), 'sent',      'Envoyée',    'مرسلة'),
  (gen_random_uuid(), 'delivered', 'Délivrée',   'تم التسليم'),
  (gen_random_uuid(), 'read',      'Lue',        'مقروءة'),
  (gen_random_uuid(), 'failed',    'Échec',      'فشل')
ON CONFLICT (code) DO NOTHING;

UPDATE "po_statuses" SET "is_terminal" = true WHERE "code" IN ('received', 'cancelled');

-- ────────────────────────────────────────────────────────────────────
-- Rattrapage des données existantes
-- ────────────────────────────────────────────────────────────────────
-- Statut des SKU : la colonne texte historique alimente la référence.
UPDATE "skus" s SET "status_id" = st."id"
FROM "sku_statuses" st
WHERE s."status_id" IS NULL AND st."code" = CASE
  WHEN lower(coalesce(s."status", '')) IN ('draft', 'brouillon') THEN 'draft'
  WHEN lower(coalesce(s."status", '')) IN ('inactive', 'inactif') THEN 'inactive'
  WHEN lower(coalesce(s."status", '')) IN ('discontinued', 'arrete', 'arrêté') THEN 'discontinued'
  ELSE 'active' END;

-- Rôles des préparateurs et livreurs.
UPDATE "pickers" SET "role_id" = (SELECT id FROM "roles" WHERE code = 'picker' LIMIT 1) WHERE "role_id" IS NULL;
UPDATE "drivers" SET "role_id" = (SELECT id FROM "roles" WHERE code = 'driver' LIMIT 1) WHERE "role_id" IS NULL;

-- Notifications déjà envoyées.
UPDATE "notifications" n SET
  "status_id" = (SELECT id FROM "notification_statuses" WHERE code = CASE WHEN n."is_read" THEN 'read' ELSE 'sent' END),
  "created_at" = n."sent_at"
WHERE n."status_id" IS NULL;

-- Livre des points : références jusqu'ici encodées dans le libellé ([rule:…], [ref:…], [play:…]).
-- (UPDATE autorisé ici : le trigger append-only est désactivé le temps du rattrapage.)
ALTER TABLE "points_transactions" DISABLE TRIGGER points_transactions_append_only;
-- Une référence n'est rattachée que si la ligne ciblée existe encore.
UPDATE "points_transactions" pt SET "points_rule_id" = r."id"
FROM "points_rules" r
WHERE pt."points_rule_id" IS NULL AND r."id"::text = substring(pt."label" from '\[rule:([0-9a-fA-F-]{36})\]');
UPDATE "points_transactions" pt SET "referral_id" = r."id"
FROM "referrals" r
WHERE pt."referral_id" IS NULL AND r."id"::text = substring(pt."label" from '\[ref:([0-9a-fA-F-]{36})\]');
UPDATE "points_transactions" pt SET "game_play_id" = g."id"
FROM "gamification_plays" g
WHERE pt."game_play_id" IS NULL AND g."id"::text = substring(pt."label" from '\[play:([0-9a-fA-F-]{36})\]');
UPDATE "points_transactions" pt SET "txn_type_id" = t."id"
FROM "points_txn_types" t
WHERE pt."txn_type_id" IS NULL AND t."code" = CASE
  WHEN pt."type" IN ('order_payment', 'earn', 'earned', 'order')              THEN 'order_payment'
  WHEN pt."type" IN ('refund')                                                 THEN 'refund'
  WHEN pt."type" IN ('referral_reward', 'referral')                            THEN 'referral_reward'
  WHEN pt."type" IN ('promo_credit', 'promo')                                  THEN 'promo_credit'
  WHEN pt."type" IN ('prize_award', 'prize', 'game')                           THEN 'prize_award'
  WHEN pt."type" IN ('sku_exchange', 'redeem', 'redeemed', 'exchange')         THEN 'sku_exchange'
  WHEN pt."type" IN ('exchange_revert')                                        THEN 'exchange_revert'
  ELSE 'manual_adjustment' END;
ALTER TABLE "points_transactions" ENABLE TRIGGER points_transactions_append_only;

-- ────────────────────────────────────────────────────────────────────
-- Unicités anti-rejeu du classeur
-- ────────────────────────────────────────────────────────────────────
-- WF-38 : une seule attribution par (commande, règle)
CREATE UNIQUE INDEX IF NOT EXISTS "points_transactions_order_rule_key"
  ON "points_transactions" ("order_id", "points_rule_id")
  WHERE "order_id" IS NOT NULL AND "points_rule_id" IS NOT NULL;
-- WF-06 : une seule récompense de parrainage par (parrainage, client)
CREATE UNIQUE INDEX IF NOT EXISTS "points_transactions_referral_customer_key"
  ON "points_transactions" ("referral_id", "customer_id")
  WHERE "referral_id" IS NOT NULL;
