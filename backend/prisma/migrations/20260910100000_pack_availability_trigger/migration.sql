-- ============================================================================
-- WF #23 / US-102 — Synchronisation temps réel de la disponibilité des packs.
--
-- 1. SOURCE DE VÉRITÉ (read-time) : pack_assemblable_count() et la vue
--    pack_availability_v calculent à la volée
--      packs_assemblables = MIN sur pack_items de FLOOR(stock_levels.qty_available / pack_items.qty)
--    (jointure packs.node_id x pack_items.sku_id ; SKU sans stock_levels = 0). Jamais stocké.
-- 2. FLAG MATÉRIALISÉ : pack_recompute_availability() réévalue
--      packs.is_available = (is_backorderable OU assemblables >= 1)
--                           ET (max_pack_qty IS NULL OU sold_count < max_pack_qty)
--    et met à jour packs.availability_updated_at = now().
-- 3. DÉCLENCHEURS : stock_levels (INSERT / UPDATE de qty_available), pack_items
--    (INSERT / UPDATE / DELETE), packs (INSERT, UPDATE de node_id, is_backorderable,
--    max_pack_qty, sold_count, is_active, is_deleted).
--    Pas de récursion : la fonction ne modifie que is_available / availability_updated_at,
--    colonnes absentes des conditions WHEN du trigger sur packs.
-- 4. PUSH : pg_notify('pack_availability', json) quand le flag change (ou quand
--    is_active / is_deleted / node_id changent) -> passerelle Socket.IO `pack:availability`.
-- SQL pur : aucune modification de schema.prisma (fonctions, vue et triggers non gérés par Prisma).
-- ============================================================================

-- --- 1. Calcul read-time ------------------------------------------------------
CREATE OR REPLACE FUNCTION pack_assemblable_count(p_pack_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
           MIN(FLOOR(GREATEST(COALESCE(sl.qty_available, 0), 0) / NULLIF(pi.qty, 0)))::integer,
           0)
    FROM packs p
    JOIN pack_items pi ON pi.pack_id = p.id
    LEFT JOIN stock_levels sl ON sl.node_id = p.node_id AND sl.sku_id = pi.sku_id
   WHERE p.id = p_pack_id
     AND p.node_id IS NOT NULL
$$;

CREATE OR REPLACE VIEW pack_availability_v AS
SELECT p.id                                   AS pack_id,
       p.node_id,
       p.is_active,
       p.is_deleted,
       p.is_backorderable,
       p.max_pack_qty,
       p.sold_count,
       a.assemblable_count,
       CASE WHEN p.max_pack_qty IS NULL THEN NULL
            ELSE GREATEST(p.max_pack_qty - p.sold_count, 0) END                     AS remaining_cap,
       CASE WHEN p.is_backorderable THEN
              CASE WHEN p.max_pack_qty IS NULL THEN NULL
                   ELSE GREATEST(p.max_pack_qty - p.sold_count, 0) END
            WHEN p.max_pack_qty IS NULL THEN a.assemblable_count
            ELSE LEAST(a.assemblable_count, GREATEST(p.max_pack_qty - p.sold_count, 0)) END AS sellable_qty,
       ((p.is_backorderable OR a.assemblable_count >= 1)
         AND (p.max_pack_qty IS NULL OR p.sold_count < p.max_pack_qty))            AS computed_is_available,
       p.is_available                          AS is_available_flag,
       p.availability_updated_at
  FROM packs p
  CROSS JOIN LATERAL (SELECT pack_assemblable_count(p.id) AS assemblable_count) a;

-- --- 2. Recalcul du flag + NOTIFY -------------------------------------------
CREATE OR REPLACE FUNCTION pack_recompute_availability(p_pack_id uuid, p_source text DEFAULT NULL, p_force_notify boolean DEFAULT FALSE)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_pack        packs%ROWTYPE;
  v_assemblable integer;
  v_new         boolean;
  v_now         timestamptz := now();
BEGIN
  SELECT * INTO v_pack FROM packs WHERE id = p_pack_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_assemblable := pack_assemblable_count(p_pack_id);
  v_new := (v_pack.is_backorderable OR v_assemblable >= 1)
           AND (v_pack.max_pack_qty IS NULL OR v_pack.sold_count < v_pack.max_pack_qty);

  -- Ne touche QUE is_available / availability_updated_at : ne réveille pas le trigger sur packs.
  UPDATE packs
     SET is_available = v_new,
         availability_updated_at = v_now
   WHERE id = p_pack_id;

  IF p_force_notify OR v_pack.is_available IS DISTINCT FROM v_new THEN
    PERFORM pg_notify('pack_availability', json_build_object(
      'pack_id',                 v_pack.id,
      'node_id',                 v_pack.node_id,
      'is_available',            v_new,
      'previous_is_available',   v_pack.is_available,
      'is_active',               v_pack.is_active,
      'is_deleted',              v_pack.is_deleted,
      'is_backorderable',        v_pack.is_backorderable,
      'assemblable_count',       v_assemblable,
      'max_pack_qty',            v_pack.max_pack_qty,
      'sold_count',              v_pack.sold_count,
      'remaining_cap',           CASE WHEN v_pack.max_pack_qty IS NULL THEN NULL
                                      ELSE GREATEST(v_pack.max_pack_qty - v_pack.sold_count, 0) END,
      'availability_updated_at', v_now,
      'source',                  p_source
    )::text);
  END IF;

  RETURN v_new;
END;
$$;

-- --- 3a. Déclencheur stock_levels ---------------------------------------------
CREATE OR REPLACE FUNCTION trg_stock_levels_pack_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  -- Packs (non supprimés) contenant ce SKU sur ce node.
  FOR r IN
    SELECT DISTINCT p.id
      FROM packs p
      JOIN pack_items pi ON pi.pack_id = p.id
     WHERE pi.sku_id = NEW.sku_id
       AND p.node_id = NEW.node_id
       AND p.is_deleted = FALSE
  LOOP
    PERFORM pack_recompute_availability(r.id, 'stock_levels', FALSE);
  END LOOP;

  -- Changement de clé (rare) : recalcul aussi pour l'ancien couple (node, SKU).
  IF TG_OP = 'UPDATE' AND (OLD.sku_id IS DISTINCT FROM NEW.sku_id OR OLD.node_id IS DISTINCT FROM NEW.node_id) THEN
    FOR r IN
      SELECT DISTINCT p.id
        FROM packs p
        JOIN pack_items pi ON pi.pack_id = p.id
       WHERE pi.sku_id = OLD.sku_id
         AND p.node_id = OLD.node_id
         AND p.is_deleted = FALSE
    LOOP
      PERFORM pack_recompute_availability(r.id, 'stock_levels', FALSE);
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_levels_pack_availability_ins ON stock_levels;
CREATE TRIGGER trg_stock_levels_pack_availability_ins
  AFTER INSERT ON stock_levels
  FOR EACH ROW
  EXECUTE FUNCTION trg_stock_levels_pack_availability();

DROP TRIGGER IF EXISTS trg_stock_levels_pack_availability_upd ON stock_levels;
CREATE TRIGGER trg_stock_levels_pack_availability_upd
  AFTER UPDATE ON stock_levels
  FOR EACH ROW
  WHEN (OLD.qty_available IS DISTINCT FROM NEW.qty_available
        OR OLD.sku_id IS DISTINCT FROM NEW.sku_id
        OR OLD.node_id IS DISTINCT FROM NEW.node_id)
  EXECUTE FUNCTION trg_stock_levels_pack_availability();

-- --- 3b. Déclencheur pack_items (composition) -------------------------------
CREATE OR REPLACE FUNCTION trg_pack_items_pack_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM pack_recompute_availability(NEW.pack_id, 'pack_items', FALSE);
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.pack_id IS DISTINCT FROM NEW.pack_id) THEN
    PERFORM pack_recompute_availability(OLD.pack_id, 'pack_items', FALSE);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pack_items_pack_availability ON pack_items;
CREATE TRIGGER trg_pack_items_pack_availability
  AFTER INSERT OR UPDATE OF pack_id, sku_id, qty OR DELETE ON pack_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_pack_items_pack_availability();

-- --- 3c. Déclencheur packs (règles de vente du pack) ------------------------
CREATE OR REPLACE FUNCTION trg_packs_pack_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pack_recompute_availability(
    NEW.id,
    'packs',
    TG_OP = 'INSERT'
      OR OLD.is_active  IS DISTINCT FROM NEW.is_active
      OR OLD.is_deleted IS DISTINCT FROM NEW.is_deleted
      OR OLD.node_id    IS DISTINCT FROM NEW.node_id
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_packs_availability_ins ON packs;
CREATE TRIGGER trg_packs_availability_ins
  AFTER INSERT ON packs
  FOR EACH ROW
  EXECUTE FUNCTION trg_packs_pack_availability();

-- La clause WHEN n'inclut ni is_available ni availability_updated_at : l'UPDATE fait par
-- pack_recompute_availability() ne peut donc pas re-déclencher ce trigger (pas de récursion).
DROP TRIGGER IF EXISTS trg_packs_availability_upd ON packs;
CREATE TRIGGER trg_packs_availability_upd
  AFTER UPDATE ON packs
  FOR EACH ROW
  WHEN (OLD.is_backorderable IS DISTINCT FROM NEW.is_backorderable
        OR OLD.max_pack_qty  IS DISTINCT FROM NEW.max_pack_qty
        OR OLD.sold_count    IS DISTINCT FROM NEW.sold_count
        OR OLD.is_active     IS DISTINCT FROM NEW.is_active
        OR OLD.is_deleted    IS DISTINCT FROM NEW.is_deleted
        OR OLD.node_id       IS DISTINCT FROM NEW.node_id)
  EXECUTE FUNCTION trg_packs_pack_availability();

-- --- 4. Initialisation des flags existants ----------------------------------
SELECT pack_recompute_availability(id, 'migration', FALSE) FROM packs;
