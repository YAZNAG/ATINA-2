-- Données de référence P0 (après `npx prisma db push` ou migration).
-- INSERT idempotents : relancer sans doublon si besoin.

-- stock_operations (PK = code)
INSERT INTO stock_operations (code, name_fr) VALUES
  ('IN', 'Entrée'),
  ('OUT', 'Sortie'),
  ('NEUTRAL', 'Neutre')
ON CONFLICT (code) DO NOTHING;
-- costing_methods (nécessaire pour reorder_rules)
INSERT INTO costing_methods (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('FIFO', 'FIFO', 'FIFO'),
  ('CUMP', 'CUMP (coût moyen)', 'CUMP')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM costing_methods c WHERE c.code = v.code);

-- delivery_types
INSERT INTO delivery_types (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('home', 'À domicile', 'التوصيل للمنزل'),
  ('pickup', 'Retrait', 'الاستلام')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM delivery_types d WHERE d.code = v.code);

-- order_statuses
INSERT INTO order_statuses (id, code, name_fr, name_ar, is_terminal, sort_order, color)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar, v.is_terminal::boolean, v.sort_order::smallint, v.color
FROM (VALUES
  ('pending', 'En attente', 'قيد الانتظار', false, 0, 'orange'),
  ('confirmed', 'Confirmée', 'مؤكدة', false, 1, 'blue'),
  ('picking', 'Préparation', 'جاري التحضير', false, 2, 'purple'),
  ('ready', 'Prête', 'جاهزة', false, 3, 'cyan'),
  ('in_delivery', 'En livraison', 'قيد التوصيل', false, 4, 'indigo'),
  ('delivered', 'Livrée', 'تم التسليم', true, 5, 'green'),
  ('cancelled', 'Annulée', 'ملغاة', true, 6, 'red'),
  ('returned', 'Retournée', 'مرتجعة', true, 7, 'gray'),
  ('awaiting_stock', 'En attente stock', 'في انتظار المخزون', false, 8, 'yellow')
) AS v(code, name_fr, name_ar, is_terminal, sort_order, color)
WHERE NOT EXISTS (SELECT 1 FROM order_statuses o WHERE o.code = v.code);

-- order_item_statuses
INSERT INTO order_item_statuses (id, code, name_fr, name_ar, color)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar, v.color
FROM (VALUES
  ('active', 'Actif', 'نشط', 'green'),
  ('cancelled', 'Annulé', 'ملغى', 'red'),
  ('substituted', 'Substitué', 'مستبدل', 'blue'),
  ('out_of_stock', 'Rupture', 'نفاد', 'orange')
) AS v(code, name_fr, name_ar, color)
WHERE NOT EXISTS (SELECT 1 FROM order_item_statuses o WHERE o.code = v.code);

-- payment_statuses
INSERT INTO payment_statuses (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('pending', 'En attente', 'معلق'),
  ('collected', 'Encaissé', 'محصّل'),
  ('failed', 'Échoué', 'فشل'),
  ('refunded', 'Remboursé', 'مسترد')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM payment_statuses p WHERE p.code = v.code);

-- payment_methods
INSERT INTO payment_methods (id, code, name_fr, name_ar, is_active)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar, v.active::boolean
FROM (VALUES
  ('cod',    'Paiement à la livraison', 'الدفع عند الاستلام', 'true'),
  ('wallet', 'Portefeuille',            'المحفظة',            'true'),
  ('mixed',  'Mixte',                   'مختلط',             'false'),
  ('card',   'Carte bancaire (Stripe)', 'بطاقة بنكية',       'false')
) AS v(code, name_fr, name_ar, active)
WHERE NOT EXISTS (SELECT 1 FROM payment_methods p WHERE p.code = v.code);
-- Activer card si déjà existant mais inactif (ignorer si erreur)
UPDATE payment_methods SET name_fr = 'Carte bancaire (Stripe)', name_ar = 'بطاقة بنكية'
WHERE code = 'card';

-- config_value_types
INSERT INTO config_value_types (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('string', 'Texte', 'نص'),
  ('integer', 'Entier', 'عدد صحيح'),
  ('decimal', 'Décimal', 'عشري'),
  ('boolean', 'Booléen', 'منطقي'),
  ('json', 'JSON', 'JSON')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM config_value_types c WHERE c.code = v.code);

-- move_types (traçabilité stock — idempotent)
INSERT INTO stock_operations (code, name_fr) VALUES
  ('IN',      'Entrée'),
  ('OUT',     'Sortie'),
  ('NEUTRAL', 'Neutre')
ON CONFLICT (code) DO NOTHING;

INSERT INTO move_types (id, code, operation, name_fr, name_ar, color)
SELECT gen_random_uuid(), v.code, v.operation::\"StockOperation\", v.name_fr, v.name_ar, v.color
FROM (VALUES
  ('reservation',        'NEUTRAL', 'Réservation commande',   'حجز الطلبية',  '#6366F1'),
  ('reservation_cancel', 'NEUTRAL', 'Annulation réservation', 'إلغاء الحجز',  '#9CA3AF'),
  ('sale',               'OUT',     'Vente / sortie',          'بيع / خروج',  '#EF4444'),
  ('reception',          'IN',      'Réception',               'استلام',      '#10B981'),
  ('adjustment_in',      'IN',      'Ajustement entrée',       'تسوية دخول',  '#3B82F6'),
  ('adjustment_out',     'OUT',     'Ajustement sortie',       'تسوية خروج',  '#F59E0B'),
  ('return_in',          'IN',      'Retour client',           'إرجاع العميل', '#8B5CF6')
) AS v(code, operation, name_fr, name_ar, color)
WHERE NOT EXISTS (SELECT 1 FROM move_types m WHERE m.code = v.code);

-- picking_statuses
INSERT INTO picking_statuses (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('open',        'En attente',  'في الانتظار'),
  ('in_progress', 'En cours',    'جارٍ'),
  ('completed',   'Terminée',    'مكتملة'),
  ('cancelled',   'Annulée',     'ملغاة')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM picking_statuses p WHERE p.code = v.code);

-- pick_item_statuses
INSERT INTO pick_item_statuses (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('pending',      'En attente',   'في الانتظار'),
  ('picked',       'Prélevé',      'تم الأخذ'),
  ('substituted',  'Substitué',    'مستبدل'),
  ('out_of_stock', 'Rupture',      'نفاد')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM pick_item_statuses p WHERE p.code = v.code);

-- tour_statuses
INSERT INTO tour_statuses (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('planned',     'Planifiée',   'مخططة'),
  ('in_progress', 'En cours',    'جارية'),
  ('completed',   'Terminée',    'مكتملة'),
  ('cancelled',   'Annulée',     'ملغاة')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM tour_statuses t WHERE t.code = v.code);

-- stop_statuses
INSERT INTO stop_statuses (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('pending',   'En attente',   'في الانتظار'),
  ('arrived',   'Arrivé',       'وصل'),
  ('delivered', 'Livré',        'تم التسليم'),
  ('failed',    'Échec',        'فشل'),
  ('skipped',   'Ignoré',       'متخطى')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM stop_statuses s WHERE s.code = v.code);

-- wallet_txn_types
INSERT INTO wallet_txn_types (id, code, name_fr, name_ar, direction)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar, v.direction
FROM (VALUES
  ('debit_order',     'Débit commande',    'خصم طلب',         'debit'),
  ('credit_refund',   'Remboursement',     'استرداد',          'credit'),
  ('credit_recharge', 'Recharge',          'شحن',             'credit'),
  ('credit_points',   'Conversion points', 'تحويل نقاط',      'credit'),
  ('debit_adjust',    'Ajustement débit',  'تعديل خصم',       'debit'),
  ('credit_adjust',   'Ajustement crédit', 'تعديل ائتمان',    'credit')
) AS v(code, name_fr, name_ar, direction)
WHERE NOT EXISTS (SELECT 1 FROM wallet_txn_types w WHERE w.code = v.code);

-- notification_channels
INSERT INTO notification_channels (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('app',   'Application', 'التطبيق'),
  ('sms',   'SMS',         'رسالة نصية'),
  ('email', 'Email',       'بريد إلكتروني')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM notification_channels n WHERE n.code = v.code);
