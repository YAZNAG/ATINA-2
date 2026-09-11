const prisma = require('../../config/database');

/*
 * Garde-fous du plafond flash (stock_flash) — WF #1 (étape 7), WF #18 (section D), US-074, US-075, US-111,
 * FAQ Décisions « stock_flash ».
 *
 * stock_flash est un PLAFOND COMMERCIAL (quota d'unités au prix flash), jamais un stock : il ne crée aucune unité.
 *
 *  CIBLE PRODUIT, non vendable en rupture (selling_rules.is_backorderable = FAUX)
 *     plafond = qty_available du couple node × SKU — BLOQUANT ; création refusée si qty_available = 0.
 *  CIBLE PRODUIT, vendable en rupture
 *     plafond = qty_available + capacité de backorder restante (backorder_limit − backordered_quantity) ;
 *     illimité si backorder_limit = 0 ; avertissement : part vendue en rupture + estimated_restock_days.
 *  CIBLE PACK (packs entiers)
 *     packs_assemblables = MIN(FLOOR(qty_available composant / pack_items.qty)) ; borné par packs.max_pack_qty
 *     (toujours bloquant) ; si packs.is_backorderable = VRAI, dépasser les packs assemblables n'est qu'un avertissement.
 *
 * En modification (sold_count > 0), les unités déjà vendues au prix flash ont déjà quitté qty_available
 * (réservées ou livrées) : le plafond accepté vaut donc sold_count + plafond du moment. À la création
 * (sold_count = 0) c'est exactement la formule du classeur. Pour un pack, le plafond commercial restant
 * est max_pack_qty − packs.sold_count.
 */

const num = (v) => Number(v ?? 0);

async function computeSkuCeiling(nodeId, skuId, db = prisma) {
  const [sku, rule, stock] = await Promise.all([
    db.sku.findFirst({ where: { id: skuId, is_deleted: false }, select: { id: true, sku_code: true, name_fr: true } }),
    db.sellingRule.findUnique({ where: { node_id_sku_id: { node_id: nodeId, sku_id: skuId } } }),
    db.stockLevel.findUnique({ where: { node_id_sku_id: { node_id: nodeId, sku_id: skuId } } }),
  ]);
  if (!sku) throw { statusCode: 404, message: 'Produit (SKU) introuvable' };

  const qtyAvailable = Math.max(0, num(stock?.qty_available));
  const availableUnits = Math.floor(qtyAvailable);
  const isBackorderable = rule ? !!rule.is_backorderable : false;
  const backorderLimit = num(rule?.backorder_limit);
  const backordered = num(rule?.backordered_quantity);
  const capacity = !isBackorderable ? 0 : (backorderLimit === 0 ? null : Math.max(0, backorderLimit - backordered));

  let maxNew;
  let explanation;
  if (!isBackorderable) {
    maxNew = availableUnits;
    explanation = `quantité disponible du node (${availableUnits})`;
  } else if (capacity === null) {
    maxNew = null;
    explanation = 'vente en rupture autorisée sans limite (backorder_limit = 0) : plafond libre';
  } else {
    maxNew = Math.floor(qtyAvailable + capacity);
    explanation = `quantité disponible (${availableUnits}) + capacité de rupture restante (${Math.floor(capacity)} = ${backorderLimit} − ${backordered})`;
  }

  return {
    target: 'sku',
    sku_id: sku.id,
    sku_code: sku.sku_code,
    name_fr: sku.name_fr,
    has_selling_rule: !!rule,
    has_stock_level: !!stock,
    is_sellable: rule ? !!rule.is_sellable : false,
    is_backorderable: isBackorderable,
    qty_available: availableUnits,
    backorder_limit: backorderLimit,
    backordered_quantity: backordered,
    backorder_capacity: capacity,          // null = illimitée
    estimated_restock_days: rule?.estimated_restock_days ?? null,
    max_new: maxNew,                       // plafond du moment (null = illimité)
    explanation,
    creation_refused: !isBackorderable && availableUnits <= 0,
    refusal_reason: !isBackorderable && availableUnits <= 0
      ? (rule
        ? 'Création refusée : ce produit n\'est pas vendable en rupture et sa quantité disponible sur ce node est de 0.'
        : 'Création refusée : ce produit n\'a pas de règle de vente sur ce node et aucune quantité disponible.')
      : null,
  };
}

async function computePackCeiling(nodeId, packId, db = prisma) {
  const pack = await db.pack.findFirst({
    where: { id: packId, is_deleted: false },
    select: {
      id: true, node_id: true, name_fr: true, max_pack_qty: true, is_backorderable: true,
      estimated_restock_days: true, sold_count: true, is_active: true,
      pack_items: {
        orderBy: { sort_order: 'asc' },
        select: {
          qty: true, sku_id: true,
          sku: { select: { id: true, sku_code: true, name_fr: true, stock_levels: { where: { node_id: nodeId }, select: { qty_available: true } } } },
        },
      },
    },
  });
  if (!pack) throw { statusCode: 404, message: 'Pack introuvable' };
  if (pack.node_id !== nodeId) throw { statusCode: 400, message: 'Ce pack n\'appartient pas au node sélectionné : une vente flash pack cible le node du pack.' };

  const components = pack.pack_items.map((it) => {
    const qtyAvailable = Math.max(0, num(it.sku?.stock_levels?.[0]?.qty_available));
    const perPack = num(it.qty) || 1;
    return {
      sku_id: it.sku_id,
      sku_code: it.sku?.sku_code ?? null,
      name_fr: it.sku?.name_fr ?? null,
      qty_per_pack: perPack,
      qty_available: qtyAvailable,
      packs_possible: perPack > 0 ? Math.floor(qtyAvailable / perPack) : 0,
    };
  });

  let assemblable = 0;
  let limiting = null;
  if (components.length) {
    limiting = components.reduce((min, c) => (min == null || c.packs_possible < min.packs_possible ? c : min), null);
    assemblable = Math.max(0, limiting.packs_possible);
  }

  const maxPackQty = pack.max_pack_qty != null ? Number(pack.max_pack_qty) : null;
  const packSold = num(pack.sold_count);
  const remainingCap = maxPackQty != null ? Math.max(0, maxPackQty - packSold) : null;
  const isBackorderable = !!pack.is_backorderable;

  let maxNew;
  let explanation;
  const limitingLabel = limiting ? `${limiting.name_fr ?? limiting.sku_code} (${limiting.qty_available} dispo ÷ ${limiting.qty_per_pack} par pack)` : '—';
  if (!components.length) {
    maxNew = 0;
    explanation = 'pack sans composant';
  } else if (isBackorderable) {
    maxNew = remainingCap;
    explanation = remainingCap == null
      ? 'pack vendable en rupture, sans plafond max_pack_qty : plafond libre'
      : `plafond commercial du pack (max_pack_qty ${maxPackQty} − ${packSold} déjà vendus = ${remainingCap})`;
  } else {
    maxNew = remainingCap != null ? Math.min(assemblable, remainingCap) : assemblable;
    explanation = remainingCap != null && remainingCap < assemblable
      ? `plafond commercial du pack (max_pack_qty ${maxPackQty} − ${packSold} déjà vendus = ${remainingCap})`
      : `packs assemblables (${assemblable}) — composant limitant : ${limitingLabel}`;
  }

  const refused = !components.length || (!isBackorderable && maxNew <= 0) || (isBackorderable && remainingCap === 0);
  let refusalReason = null;
  if (!components.length) refusalReason = 'Création refusée : ce pack n\'a aucun composant.';
  else if (isBackorderable && remainingCap === 0) refusalReason = 'Création refusée : le plafond commercial du pack (max_pack_qty) est atteint.';
  else if (!isBackorderable && maxNew <= 0) {
    refusalReason = remainingCap === 0
      ? 'Création refusée : le plafond commercial du pack (max_pack_qty) est atteint.'
      : `Création refusée : aucun pack assemblable avec le stock du node (composant limitant : ${limitingLabel}).`;
  }

  return {
    target: 'pack',
    pack_id: pack.id,
    name_fr: pack.name_fr,
    pack_is_active: pack.is_active,
    is_backorderable: isBackorderable,
    estimated_restock_days: pack.estimated_restock_days,
    components,
    packs_assemblable: assemblable,
    limiting_component: limiting,
    max_pack_qty: maxPackQty,
    pack_sold_count: packSold,
    remaining_pack_cap: remainingCap,
    max_new: maxNew,
    explanation,
    creation_refused: refused,
    refusal_reason: refusalReason,
  };
}

async function computeCeiling({ node_id, sku_id, pack_id }, db = prisma) {
  if (!node_id) throw { statusCode: 400, message: 'Sélectionnez le node' };
  if (sku_id && pack_id) throw { statusCode: 400, message: 'Choisissez un produit OU un pack, pas les deux' };
  if (sku_id) return computeSkuCeiling(String(node_id), String(sku_id), db);
  if (pack_id) return computePackCeiling(String(node_id), String(pack_id), db);
  throw { statusCode: 400, message: 'Sélectionnez un produit (SKU) ou un pack' };
}

/**
 * Évalue un plafond flash saisi.
 * @param {object} ceiling   résultat de computeCeiling
 * @param {number} stockFlash valeur saisie
 * @param {object} opts { soldCount = 0, changed = true, creation = false }
 * @returns {{ errors:string[], warnings:string[], min_allowed:number, max_allowed:number|null }}
 */
function evaluateStockFlash(ceiling, stockFlash, { soldCount = 0, changed = true, creation = false } = {}) {
  const errors = [];
  const warnings = [];
  const sold = Number(soldCount || 0);
  const value = Number(stockFlash);
  const maxAllowed = ceiling.max_new == null ? null : sold + ceiling.max_new;
  const unit = ceiling.target === 'pack' ? 'pack(s)' : 'unité(s)';

  if (creation && ceiling.creation_refused) {
    errors.push(ceiling.refusal_reason);
    return { errors, warnings, min_allowed: 1, max_allowed: maxAllowed };
  }

  if (changed && (!Number.isInteger(value) || value < 1)) {
    errors.push('Le plafond flash (stock_flash) doit être un entier supérieur ou égal à 1.');
    return { errors, warnings, min_allowed: Math.max(1, sold), max_allowed: maxAllowed };
  }

  if (changed && value < sold) {
    errors.push(`Plafond flash refusé : valeur minimale acceptée = ${sold} (${unit} déjà vendu(s) au prix flash). Pour arrêter la vente immédiatement, désactivez-la.`);
  }

  if (maxAllowed != null && value > maxAllowed) {
    const detail = sold > 0 ? `${sold} déjà vendu(s) + ${ceiling.explanation}` : ceiling.explanation;
    if (changed) {
      errors.push(`Plafond flash refusé : valeur maximale acceptée = ${maxAllowed} ${unit} (${detail}).`);
    } else {
      warnings.push(`Attention : le plafond flash actuel (${value}) dépasse le plafond du moment (${maxAllowed} ${unit} — ${detail}). Aucune correction automatique : la vente reste limitée par le stock réellement disponible.`);
    }
  }

  const remaining = Math.max(0, value - sold);
  if (ceiling.target === 'sku' && ceiling.is_backorderable) {
    const partRupture = Math.max(0, remaining - ceiling.qty_available);
    if (partRupture > 0) {
      warnings.push(`${partRupture} unité(s) seront vendues en rupture (quantité disponible : ${ceiling.qty_available}). Délai de réapprovisionnement estimé : ${ceiling.estimated_restock_days ?? '?'} jour(s) — les créneaux standard ne seront pas proposés pour ces unités.`);
    }
  }
  if (ceiling.target === 'pack' && ceiling.is_backorderable && remaining > ceiling.packs_assemblable) {
    const lim = ceiling.limiting_component;
    warnings.push(`Seuls ${ceiling.packs_assemblable} pack(s) sont assemblables avec le stock actuel${lim ? ` (composant limitant : ${lim.name_fr ?? lim.sku_code})` : ''}. Les packs manquants seront livrés avec un délai de ${ceiling.estimated_restock_days ?? '?'} jour(s).`);
  }
  if (ceiling.target === 'sku' && ceiling.has_selling_rule && !ceiling.is_sellable) {
    warnings.push('Ce produit n\'est pas vendable sur ce node (selling_rules.is_sellable = faux) : la carte flash ne sera pas affichée tant qu\'il ne l\'est pas.');
  }
  if (ceiling.target === 'pack' && ceiling.pack_is_active === false) {
    warnings.push('Ce pack est inactif : la carte flash ne sera pas affichée tant qu\'il ne sera pas réactivé.');
  }

  return { errors, warnings, min_allowed: Math.max(1, sold), max_allowed: maxAllowed };
}

module.exports = { computeCeiling, computeSkuCeiling, computePackCeiling, evaluateStockFlash };
