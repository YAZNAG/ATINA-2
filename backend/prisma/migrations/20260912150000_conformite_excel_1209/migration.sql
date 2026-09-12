-- ════════════════════════════════════════════════════════════════════
--  Conformité au classeur « Atina Suivi 12-09-2026 »
--  Section Admin / Configuration : référentiels d'audit et de
--  notification, paiements par node, paramètres globaux, droits
--  atomiques, images obligatoires de la hiérarchie produit.
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. Référentiels (remplacent des champs texte libres)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_actions" (
  "id"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"    VARCHAR(50)  NOT NULL UNIQUE,
  "name_fr" VARCHAR(100) NOT NULL,
  "name_ar" VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_resources" (
  "id"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"    VARCHAR(50)  NOT NULL UNIQUE,
  "name_fr" VARCHAR(100) NOT NULL,
  "name_ar" VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_types" (
  "id"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"    VARCHAR(50)  NOT NULL UNIQUE,
  "name_fr" VARCHAR(100) NOT NULL,
  "name_ar" VARCHAR(100) NOT NULL
);

-- Catalogue fermé des actions auditables (les codes existants sont conservés).
INSERT INTO "audit_actions" ("code", "name_fr", "name_ar") VALUES
  ('CREATE',                    'Création',                        'إنشاء'),
  ('UPDATE',                    'Modification',                    'تعديل'),
  ('DELETE',                    'Suppression',                     'حذف'),
  ('ACTIVATE',                  'Activation',                      'تفعيل'),
  ('DEACTIVATE',                'Désactivation',                   'إلغاء التفعيل'),
  ('VALIDATE',                  'Validation',                      'مصادقة'),
  ('CANCEL',                    'Annulation',                      'إلغاء'),
  ('ADJUST',                    'Ajustement de stock',             'تعديل المخزون'),
  ('RECEIVE',                   'Réception',                       'استلام'),
  ('COUNT_ENTRY',               'Saisie de comptage',              'إدخال الجرد'),
  ('STATUS_CHANGE',             'Changement de statut',            'تغيير الحالة'),
  ('UPDATE_STATUS',             'Changement de statut',            'تغيير الحالة'),
  ('CANCEL_ORDER',              'Annulation de commande',          'إلغاء الطلب'),
  ('DELIVER_ORDER',             'Livraison de commande',           'تسليم الطلب'),
  ('ADD_ORDER_LINE',            'Ajout de ligne',                  'إضافة سطر'),
  ('SUBSTITUTE_ORDER_LINE',     'Substitution de ligne',           'استبدال سطر'),
  ('ASSIGN_SLOT',               'Affectation de créneau',          'تخصيص موعد'),
  ('START_TOUR',                'Départ de tournée',               'انطلاق الجولة'),
  ('FAIL_STOP',                 'Échec de livraison',              'فشل التسليم'),
  ('COLLECT_PAYMENT',           'Encaissement',                    'تحصيل'),
  ('REDEEM_COUPON',             'Utilisation de code promo',       'استعمال رمز ترويجي'),
  ('POINTS_EXCHANGE',           'Échange de points',               'استبدال النقاط'),
  ('POINTS_RECONCILIATION_GAP', 'Écart de rapprochement points',   'فارق تسوية النقاط'),
  ('CLAIM_GAME_PRIZE',          'Réclamation de lot',              'استلام جائزة'),
  ('BLOCK_USER',                'Blocage de client',               'حظر العميل'),
  ('UNBLOCK_USER',              'Déblocage de client',             'رفع الحظر'),
  ('LOGIN',                     'Connexion',                       'تسجيل الدخول'),
  ('RESET_PASSWORD',            'Réinitialisation de mot de passe','إعادة تعيين كلمة المرور'),
  ('GRANT_PERMISSIONS',         'Attribution de permissions',      'منح الصلاحيات'),
  ('EXPORT',                    'Export',                          'تصدير')
ON CONFLICT ("code") DO NOTHING;

-- Catalogue fermé des entités auditables, aligné sur les ressources de permissions.
INSERT INTO "audit_resources" ("code", "name_fr", "name_ar") VALUES
  ('orders',                 'Commandes',                  'الطلبات'),
  ('order_items',            'Lignes de commande',         'أسطر الطلب'),
  ('order_slot_preferences', 'Préférences de créneau',     'تفضيلات المواعيد'),
  ('delivery_slots',         'Créneaux de livraison',      'مواعيد التوصيل'),
  ('tours',                  'Tournées',                   'الجولات'),
  ('tour_stops',             'Arrêts de tournée',          'محطات الجولة'),
  ('payments',               'Paiements',                  'المدفوعات'),
  ('customers',              'Clients',                    'العملاء'),
  ('skus',                   'Produits (SKU)',             'المنتجات'),
  ('sku_images',             'Images produit',             'صور المنتج'),
  ('brands',                 'Marques',                    'العلامات'),
  ('categories',             'Catégories',                 'الفئات'),
  ('families',               'Familles',                   'العائلات'),
  ('subfamilies',            'Sous-familles',              'العائلات الفرعية'),
  ('units',                  'Unités',                     'الوحدات'),
  ('nodes',                  'Nœuds',                      'النقاط'),
  ('regions',                'Régions',                    'الجهات'),
  ('cities',                 'Villes',                     'المدن'),
  ('stock_levels',           'Niveaux de stock',           'مستويات المخزون'),
  ('stock_moves',            'Mouvements de stock',        'حركات المخزون'),
  ('stock_count_sessions',   'Sessions de comptage',       'جلسات الجرد'),
  ('purchase_orders',        'Bons de commande',           'سندات الطلب'),
  ('suppliers',              'Fournisseurs',               'الموردون'),
  ('packs',                  'Packs',                      'الباقات'),
  ('flash_sales',            'Ventes flash',               'العروض السريعة'),
  ('promotions',             'Codes promo',                'الرموز الترويجية'),
  ('gamification_games',     'Jeux',                       'الألعاب'),
  ('points_rules',           'Règles de points',           'قواعد النقاط'),
  ('points_transactions',    'Livre des points',           'سجل النقاط'),
  ('points_exchange_skus',   'Produits échangeables',      'منتجات الاستبدال'),
  ('referral_config',        'Configuration parrainage',   'إعدادات الإحالة'),
  ('quality_checks',         'Contrôles qualité',          'مراقبة الجودة'),
  ('picking',                'Préparation',                'التحضير'),
  ('pickers',                'Préparateurs',               'المحضرون'),
  ('drivers',                'Livreurs',                   'الموزعون'),
  ('users',                  'Comptes back-office',        'حسابات الإدارة'),
  ('roles',                  'Rôles',                      'الأدوار'),
  ('permissions',            'Permissions',                'الصلاحيات'),
  ('app_configs',            'Paramètres applicatifs',     'إعدادات التطبيق'),
  ('node_payment_methods',   'Paiements par nœud',         'وسائل الأداء حسب النقطة'),
  ('notifications',          'Notifications',              'الإشعارات'),
  ('warehouse',              'Emplacements',               'المواقع'),
  ('wallet',                 'Portefeuille',               'المحفظة')
ON CONFLICT ("code") DO NOTHING;

-- Catalogue fermé des types de notification (remplace notifications.event_code).
INSERT INTO "notification_types" ("code", "name_fr", "name_ar") VALUES
  ('order',         'Commande',     'الطلب'),
  ('promo',         'Promotion',    'العروض'),
  ('points',        'Points',       'النقاط'),
  ('gamification',  'Gamification', 'الألعاب'),
  ('system',        'Système',      'النظام')
ON CONFLICT ("code") DO NOTHING;

-- Toute entité restée hors catalogue est rattrapée (le classeur exige un
-- référentiel fermé : on ne perd aucune valeur historique).
INSERT INTO "audit_resources" ("code", "name_fr", "name_ar")
SELECT DISTINCT a."resource", a."resource", a."resource"
FROM "audit_logs" a
WHERE a."resource" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "audit_resources" r WHERE r."code" = a."resource");

INSERT INTO "audit_actions" ("code", "name_fr", "name_ar")
SELECT DISTINCT a."action", a."action", a."action"
FROM "audit_logs" a
WHERE a."action" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "audit_actions" x WHERE x."code" = a."action");

-- ────────────────────────────────────────────────────────────────────
-- 2. audit_logs : action et entité référencées, identifiant de cible
--    (WF #46). La table est APPEND-ONLY : le trigger est désactivé le
--    temps du rattrapage.
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs" RENAME COLUMN "resource_id" TO "target_id";
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "action_id"   UUID,
  ADD COLUMN IF NOT EXISTS "resource_id" UUID;

ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_append_only";

UPDATE "audit_logs" l SET "action_id" = a."id"
FROM "audit_actions" a WHERE l."action_id" IS NULL AND a."code" = l."action";

UPDATE "audit_logs" l SET "resource_id" = r."id"
FROM "audit_resources" r WHERE l."resource_id" IS NULL AND r."code" = l."resource";

ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_append_only";

ALTER TABLE "audit_logs" ALTER COLUMN "action_id"   SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "resource_id" SET NOT NULL;
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_action_id_fkey"
    FOREIGN KEY ("action_id") REFERENCES "audit_actions"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT "audit_logs_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "audit_resources"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

DROP INDEX IF EXISTS "audit_logs_resource_resource_id_idx";
ALTER TABLE "audit_logs" DROP COLUMN "action", DROP COLUMN "resource";

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
  ON "audit_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx"
  ON "audit_logs" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_resource_target_created_idx"
  ON "audit_logs" ("resource_id", "target_id", "created_at" DESC);

-- ────────────────────────────────────────────────────────────────────
-- 3. notifications : type référencé et motif d'échec (US-126)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "type_id"       UUID,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT;

UPDATE "notifications" n SET "type_id" = t."id"
FROM "notification_types" t
WHERE n."type_id" IS NULL AND t."code" = CASE
  WHEN n."event_code" LIKE 'order%'                              THEN 'order'
  WHEN n."event_code" IN ('coupon_created', 'flash_sale_created',
                          'pack_created', 'promo_created')       THEN 'promo'
  WHEN n."event_code" LIKE 'points%' OR n."event_code"
       IN ('referral_reward', 'points_expiring')                 THEN 'points'
  WHEN n."event_code" LIKE 'game%'                               THEN 'gamification'
  ELSE 'system' END;

ALTER TABLE "notifications" ALTER COLUMN "type_id" SET NOT NULL;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_type_id_fkey"
    FOREIGN KEY ("type_id") REFERENCES "notification_types"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "notifications_created_at_idx"
  ON "notifications" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "notifications_customer_created_idx"
  ON "notifications" ("customer_id", "created_at" DESC);

-- ────────────────────────────────────────────────────────────────────
-- 4. app_configs : uniquement des clés GLOBALES (WF #41)
--    Les paramètres par node vivent déjà sur la table nodes.
-- ────────────────────────────────────────────────────────────────────
DELETE FROM "app_configs" a
USING "app_configs" b
WHERE a."config_key" = b."config_key" AND a."node_id" IS NOT NULL AND b."node_id" IS NULL;

DROP INDEX IF EXISTS "app_configs_node_id_config_key_key";
ALTER TABLE "app_configs" DROP CONSTRAINT IF EXISTS "app_configs_node_id_config_key_key";
ALTER TABLE "app_configs" DROP CONSTRAINT IF EXISTS "app_configs_node_id_fkey";
ALTER TABLE "app_configs" DROP COLUMN IF EXISTS "node_id";
CREATE UNIQUE INDEX IF NOT EXISTS "app_configs_config_key_key" ON "app_configs" ("config_key");

-- Les 7 clés globales de la liste fermée (US-118, US-119).
INSERT INTO "app_configs" ("id", "config_key", "config_value", "value_type_id", "description", "updated_by", "updated_at")
SELECT gen_random_uuid(), v."key", v."val",
       (SELECT "id" FROM "config_value_types" WHERE "code" = v."vtype" LIMIT 1),
       v."descr",
       (SELECT "id" FROM "users" ORDER BY "id" LIMIT 1),
       NOW()
FROM (VALUES
  ('week_start_day',   'monday',                   'string', 'Premier jour de la semaine : base de tous les quotas et agrégats hebdomadaires.'),
  ('default_timezone', 'Africa/Casablanca',        'string', 'Fuseau horaire par défaut de la plateforme.'),
  ('default_currency', 'MAD',                      'string', 'Devise par défaut affichée dans l''application.'),
  ('support_whatsapp', '+212600000000',            'string', 'Numéro WhatsApp du support affiché dans l''app cliente.'),
  ('cgu_url',          'https://atina.ma/cgu',     'string', 'Lien vers les conditions générales d''utilisation.'),
  ('privacy_url',      'https://atina.ma/privacy', 'string', 'Lien vers la politique de confidentialité.')
) AS v("key", "val", "vtype", "descr")
WHERE NOT EXISTS (SELECT 1 FROM "app_configs" c WHERE c."config_key" = v."key")
  AND EXISTS (SELECT 1 FROM "config_value_types" WHERE "code" = v."vtype")
  AND EXISTS (SELECT 1 FROM "users");

-- support_phone existe déjà ; la valeur historique « currency » alimente default_currency.
UPDATE "app_configs" d SET "config_value" = s."config_value"
FROM "app_configs" s
WHERE d."config_key" = 'default_currency' AND s."config_key" = 'currency'
  AND d."config_value" = 'MAD';

-- ────────────────────────────────────────────────────────────────────
-- 5. node_payment_methods : activation des moyens de paiement node par
--    node (WF #42)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "node_payment_methods" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "node_id"           UUID    NOT NULL,
  "payment_method_id" UUID    NOT NULL,
  "is_active"         BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by"        INTEGER,
  "updated_by"        INTEGER,
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "node_payment_methods_node_id_fkey"
    FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "node_payment_methods_payment_method_id_fkey"
    FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "node_payment_methods_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "node_payment_methods_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "node_payment_methods_node_method_key"
  ON "node_payment_methods" ("node_id", "payment_method_id");
CREATE INDEX IF NOT EXISTS "node_payment_methods_node_id_idx"
  ON "node_payment_methods" ("node_id");

-- Reprise : chaque node hérite de l'état global actuel du catalogue.
INSERT INTO "node_payment_methods" ("node_id", "payment_method_id", "is_active", "created_by", "updated_by")
SELECT n."id", p."id", p."is_active",
       (SELECT "id" FROM "users" ORDER BY "id" LIMIT 1),
       (SELECT "id" FROM "users" ORDER BY "id" LIMIT 1)
FROM "nodes" n
CROSS JOIN "payment_methods" p
WHERE n."is_deleted" = FALSE
ON CONFLICT ("node_id", "payment_method_id") DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- 6. Image obligatoire sur la hiérarchie produit (US-120)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "sku_families"    ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "sku_subfamilies" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- Reprise : l'image principale d'un produit de la famille sert de visuel.
UPDATE "sku_families" f SET "image_url" = (
  SELECT i."url" FROM "sku_images" i
  JOIN "skus" s ON s."id" = i."sku_id"
  WHERE s."sku_family_id" = f."id" AND s."is_deleted" = FALSE AND i."deleted_at" IS NULL
  ORDER BY i."is_primary" DESC, i."sort_order" ASC LIMIT 1)
WHERE f."image_url" IS NULL;

UPDATE "sku_subfamilies" sf SET "image_url" = (
  SELECT i."url" FROM "sku_images" i
  JOIN "skus" s ON s."id" = i."sku_id"
  WHERE s."sku_subfamily_id" = sf."id" AND s."is_deleted" = FALSE AND i."deleted_at" IS NULL
  ORDER BY i."is_primary" DESC, i."sort_order" ASC LIMIT 1)
WHERE sf."image_url" IS NULL;

UPDATE "sku_subfamilies" sf SET "image_url" = f."image_url"
FROM "sku_families" f
WHERE sf."image_url" IS NULL AND f."id" = sf."family_id" AND f."image_url" IS NOT NULL;

-- Reste : visuel généré au déploiement par scripts/hierarchy-images.js.
UPDATE "sku_families"    SET "image_url" = 'uploads/hierarchy/famille-'      || "code" || '.webp' WHERE "image_url" IS NULL;
UPDATE "sku_subfamilies" SET "image_url" = 'uploads/hierarchy/sous-famille-' || "code" || '.webp' WHERE "image_url" IS NULL;
UPDATE "categories"      SET "image_url" = 'uploads/hierarchy/categorie-'    || "code" || '.webp' WHERE "image_url" IS NULL OR "image_url" = '';

ALTER TABLE "sku_families"    ALTER COLUMN "image_url" SET NOT NULL;
ALTER TABLE "sku_subfamilies" ALTER COLUMN "image_url" SET NOT NULL;
ALTER TABLE "categories"      ALTER COLUMN "image_url" SET NOT NULL;

-- Périmètre node d'un compte back-office (US-124) : la colonne existait sans
-- contrainte, la référence est posée pour pouvoir afficher le nœud.
ALTER TABLE "backoffice_admins" DROP CONSTRAINT IF EXISTS "backoffice_admins_node_id_fkey";
UPDATE "backoffice_admins" a SET "node_id" = NULL
WHERE a."node_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "nodes" n WHERE n."id" = a."node_id");
ALTER TABLE "backoffice_admins"
  ADD CONSTRAINT "backoffice_admins_node_id_fkey"
    FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────
-- 7. Droits atomiques : ressource × action (US-121 → US-125)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "resource" VARCHAR(50);
ALTER TABLE "roles"       ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_created_by_fkey";
ALTER TABLE "roles"
  ADD CONSTRAINT "roles_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- La ressource est la partie gauche du code (« orders.view » → « orders »).
UPDATE "permissions" SET "resource" = split_part("code", '.', 1) WHERE "resource" IS NULL;

-- L'action est ramenée aux quatre verbes du classeur.
UPDATE "permissions" SET "action" = CASE
  WHEN split_part("code", '.', 2) IN ('view', 'read', 'list')                      THEN 'read'
  WHEN split_part("code", '.', 2) IN ('delete', 'destroy', 'remove')               THEN 'delete'
  WHEN split_part("code", '.', 2) IN ('export', 'download')                        THEN 'export'
  ELSE 'write' END;

-- Droits d'export manquants pour les écrans qui proposent « Exporter ».
INSERT INTO "permissions" ("code", "name", "name_fr", "name_ar", "module", "resource", "action", "description", "created_at", "updated_at")
SELECT v."code", v."label", v."label", v."label_ar", v."module", split_part(v."code", '.', 1), 'export', NULL, NOW(), NOW()
FROM (VALUES
  ('reporting.export',       'Exporter les indicateurs',       'تصدير المؤشرات',     'reporting'),
  ('orders.export',          'Exporter les commandes',         'تصدير الطلبات',      'orders'),
  ('customers.export',       'Exporter les clients',           'تصدير العملاء',      'customers'),
  ('stock.export',           'Exporter le stock',              'تصدير المخزون',      'stock'),
  ('purchase_orders.export', 'Exporter les bons de commande',  'تصدير سندات الطلب',  'purchase_orders'),
  ('audit_logs.export',      'Exporter le journal d''audit',   'تصدير سجل التدقيق',  'admin'),
  ('notifications.export',   'Exporter les notifications',     'تصدير الإشعارات',    'admin'),
  ('users.export',           'Exporter les comptes',           'تصدير الحسابات',     'users'),
  ('app_configs.export',     'Exporter la configuration',      'تصدير الإعدادات',    'admin')
) AS v("code", "label", "label_ar", "module")
WHERE NOT EXISTS (SELECT 1 FROM "permissions" p WHERE p."code" = v."code");

ALTER TABLE "permissions" ALTER COLUMN "resource" SET NOT NULL;
ALTER TABLE "permissions" ALTER COLUMN "action"   SET NOT NULL;
ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_action_check";
ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_action_check"
    CHECK ("action" IN ('read', 'write', 'delete', 'export'));
CREATE INDEX IF NOT EXISTS "permissions_resource_action_idx"
  ON "permissions" ("resource", "action");

-- Le super-admin conserve la totalité du catalogue.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('super_admin', 'superadmin')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Horodatage de l'octroi : nom du classeur.
ALTER TABLE "role_permissions" RENAME COLUMN "created_at" TO "granted_at";
