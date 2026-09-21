-- ════════════════════════════════════════════════════════════════════
--  Catalogue des permissions : retrait des droits sans ressource réelle
--  Les tables articles, article_types, article_statuses, article_images
--  et sub_categories ont été supprimées ou fusionnées dans skus (août
--  2026) ; leurs 18 droits apparaissaient encore comme lignes vides de la
--  matrice « Permissions par rôle » (US-121). Les attributions associées
--  partent avec eux (ON DELETE CASCADE sur role_permissions).
-- ════════════════════════════════════════════════════════════════════
DELETE FROM "permissions"
WHERE "resource" IN ('articles', 'article_types', 'article_statuses', 'article_images', 'sub_categories');
