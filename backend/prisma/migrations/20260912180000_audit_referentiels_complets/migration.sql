-- ════════════════════════════════════════════════════════════════════
--  Référentiels d'audit : catalogue complet
--  Tous les codes réellement écrits par le back-office reçoivent leur
--  libellé FR / AR. Les lignes créées automatiquement au vol (libellé =
--  code) sont corrigées par le DO UPDATE.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO "audit_actions" ("code", "name_fr", "name_ar") VALUES
  ('ASSIGN_ROLE',              'Affectation de rôle',              'تعيين دور'),
  ('ASSIGN_PERMISSIONS',       'Attribution de permissions',       'منح الصلاحيات'),
  ('CONFIG_CHANGE',            'Changement de configuration',      'تغيير الإعدادات'),
  ('DUPLICATE',                'Duplication',                      'استنساخ'),
  ('RESTORE',                  'Restauration',                     'استرجاع'),
  ('IMPORT',                   'Import',                           'استيراد'),
  ('BULK_CREATE',              'Création en lot',                  'إنشاء بالجملة'),
  ('REORDER',                  'Réordonnancement',                 'إعادة الترتيب'),
  ('START',                    'Démarrage',                        'بدء'),
  ('COMPLETE',                 'Clôture',                          'إتمام'),
  ('VALIDATE',                 'Validation',                       'مصادقة'),
  ('MOVE_CITY',                'Déplacement de ville',             'نقل مدينة'),
  ('MAP_SKU',                  'Rattachement d''un SKU',           'ربط منتج'),
  ('UNMAP_SKU',                'Retrait d''un SKU',                'إلغاء ربط منتج'),
  ('UPDATE_MIN_ORDER_AMOUNT',  'Modification du minimum',          'تعديل الحد الأدنى'),
  ('UPDATE_ORDER_LINE',        'Modification de ligne',            'تعديل سطر'),
  ('CUSTOMER_SUBSTITUTION',    'Substitution demandée par le client', 'استبدال بطلب العميل'),
  ('SUBSTITUTE_ITEM',          'Substitution d''article',          'استبدال مادة'),
  ('OUT_OF_STOCK_ITEM',        'Article en rupture',               'مادة غير متوفرة'),
  ('PICK_ITEM',                'Prélèvement d''article',           'التقاط مادة'),
  ('REASSIGN_PICKER',          'Réaffectation du préparateur',     'إعادة تعيين المحضر'),
  ('ADD_STOP',                 'Ajout d''un arrêt',                'إضافة محطة'),
  ('REORDER_STOPS',            'Réordonnancement des arrêts',      'إعادة ترتيب المحطات'),
  ('CANCEL_TOUR',              'Annulation de tournée',            'إلغاء الجولة'),
  ('COMPLETE_TOUR',            'Clôture de tournée',               'إنهاء الجولة'),
  ('RENEGOTIATE',              'Renégociation',                    'إعادة التفاوض'),
  ('CREATE_REFUSED',           'Création refusée',                 'رفض الإنشاء'),
  ('UPDATE_REFUSED',           'Modification refusée',             'رفض التعديل'),
  ('DELETE_REFUSED',           'Suppression refusée',              'رفض الحذف')
ON CONFLICT ("code") DO UPDATE
  SET "name_fr" = EXCLUDED."name_fr", "name_ar" = EXCLUDED."name_ar"
  WHERE "audit_actions"."name_fr" = "audit_actions"."code";

INSERT INTO "audit_resources" ("code", "name_fr", "name_ar") VALUES
  ('audit_logs',             'Journal d''audit',            'سجل التدقيق'),
  ('addresses',              'Adresses',                    'العناوين'),
  ('levels',                 'Niveaux de rayonnage',        'مستويات الرفوف'),
  ('locations',              'Emplacements',                'المواقع'),
  ('zones',                  'Zones entrepôt',              'مناطق المستودع'),
  ('pack_items',             'Composants de pack',          'مكونات الباقة'),
  ('payment_methods',        'Moyens de paiement',          'وسائل الأداء'),
  ('picking_sessions',       'Sessions de préparation',     'جلسات التحضير'),
  ('picking_session_items',  'Articles préparés',           'مواد التحضير'),
  ('reorder_rules',          'Règles de réapprovisionnement', 'قواعد التموين'),
  ('sku_node_locations',     'Emplacement d''un SKU',       'موقع المنتج'),
  ('supplier_prices',        'Prix fournisseurs',           'أسعار الموردين'),
  ('stock_count_sessions',   'Sessions de comptage',        'جلسات الجرد')
ON CONFLICT ("code") DO UPDATE
  SET "name_fr" = EXCLUDED."name_fr", "name_ar" = EXCLUDED."name_ar"
  WHERE "audit_resources"."name_fr" = "audit_resources"."code";
