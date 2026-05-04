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
INSERT INTO order_statuses (id, code, name_fr, name_ar, is_terminal, sort_order)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar, v.is_terminal::boolean, v.sort_order::smallint
FROM (VALUES
  ('pending', 'En attente', 'قيد الانتظار', false, 0),
  ('confirmed', 'Confirmée', 'مؤكدة', false, 1),
  ('picking', 'Préparation', 'جاري التحضير', false, 2),
  ('ready', 'Prête', 'جاهزة', false, 3),
  ('in_delivery', 'En livraison', 'قيد التوصيل', false, 4),
  ('delivered', 'Livrée', 'تم التسليم', true, 5),
  ('cancelled', 'Annulée', 'ملغاة', true, 6),
  ('returned', 'Retournée', 'مرتجعة', true, 7),
  ('awaiting_stock', 'En attente stock', 'في انتظار المخزون', false, 8)
) AS v(code, name_fr, name_ar, is_terminal, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM order_statuses o WHERE o.code = v.code);

-- order_item_statuses
INSERT INTO order_item_statuses (id, code, name_fr, name_ar)
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar
FROM (VALUES
  ('active', 'Actif', 'نشط'),
  ('cancelled', 'Annulé', 'ملغى'),
  ('substituted', 'Substitué', 'مستبدل'),
  ('out_of_stock', 'Rupture', 'نفاد')
) AS v(code, name_fr, name_ar)
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
SELECT gen_random_uuid(), v.code, v.name_fr, v.name_ar, true
FROM (VALUES
  ('cod', 'Paiement à la livraison', 'الدفع عند الاستلام'),
  ('wallet', 'Portefeuille', 'المحفظة'),
  ('mixed', 'Mixte', 'مختلط')
) AS v(code, name_fr, name_ar)
WHERE NOT EXISTS (SELECT 1 FROM payment_methods p WHERE p.code = v.code);

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
