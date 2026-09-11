/**
 * Étape « stock » : ajustements manuels motivés (stock_levels.adjust) et 2 sessions de
 * comptage (stock_counts) : une validée avec écarts, une ouverte.
 */
const ADJUSTMENTS = [
  ['CASA-MAARIF', 'LEG-TOM-1KG', -2, 'Casse : tomates abîmées au déchargement'],
  ['CASA-MAARIF', 'EAU-SAL-150', 3, 'Erreur de réception : colis non saisi'],
  ['CASA-AINSEBAA', 'OEU-ATI-12', -1, 'Plateau d’œufs cassé en rayon'],
  ['RABAT-AGDAL', 'FRU-BAN-1KG', -2, 'Produit trop mûr retiré de la vente'],
  ['MRK-GUELIZ', 'PAI-KHB-X2', -3, 'Invendus de la veille (pain)'],
  ['MRK-GUELIZ', 'SUR-ATI-JAV', -1, 'Bidon percé'],
];

async function run(ctx) {
  const { prisma } = ctx;
  const levelSvc = require('../../../src/modules/stock/stock_levels/stock_level.service');
  const countSvc = require('../../../src/modules/stock_counts/stock_counts.service');
  const req = ctx.dry ? null : await ctx.req();
  const nodes = Object.fromEntries((await ctx.nodes()).map((n) => [n.code, n]));
  const skus = Object.fromEntries((await ctx.skus()).map((s) => [s.code, s]));

  for (const [i, [nodeCode, skuCode, delta, reason]] of ADJUSTMENTS.entries()) {
    const node = nodes[nodeCode]; const sku = skus[skuCode];
    if (!node || !sku) continue;
    const reference = `DEMO-ADJ-${String(i + 1).padStart(2, '0')}`;
    if (await prisma.stockMove.findFirst({ where: { reference } })) continue;
    ctx.count('ajustements (stock_moves)');
    if (ctx.dry) continue;
    const level = await prisma.stockLevel.findUnique({ where: { node_id_sku_id: { node_id: node.id, sku_id: sku.id } } });
    if (!level) { ctx.warn(`Ajustement ${reference} : pas de stock pour ${skuCode}`); continue; }
    const target = Math.max(Number(level.qty_reserved), Number(level.qty_physical) + delta);
    await levelSvc.adjust({ node_id: node.id, sku_id: sku.id, qty_physical: target, reason, reference }, req);
  }

  const zones = await ctx.byCode('zone');
  const SESSIONS = [
    { node: 'CASA-MAARIF', zone: 'AMB', marker: '[DEMO:COUNT:MAA]', notes: 'Inventaire tournant du rayon ambiant', validate: true },
    { node: 'RABAT-AGDAL', zone: 'FRAIS', marker: '[DEMO:COUNT:AGD]', notes: 'Comptage de la chambre froide', validate: false },
  ];
  for (const s of SESSIONS) {
    const node = nodes[s.node];
    if (!node) continue;
    let session = await prisma.stockCountSession.findFirst({ where: { notes: { startsWith: s.marker } } });
    if (!session) {
      ctx.count('stock_count_sessions');
      if (ctx.dry) continue;
      try {
        session = await countSvc.create(req, { node_id: node.id, zone_id: zones[s.zone]?.id, notes: `${s.marker} ${s.notes}` });
      } catch (e) { ctx.warn(`Comptage ${s.node} : ${e.message}`); continue; }
    }
    if (ctx.dry || session.status !== 'open') continue;
    const full = await countSvc.getById(session.id);
    const lines = full.lines || [];
    const counted = await prisma.stockCountLine.count({ where: { session_id: session.id, qty_counted: { not: null } } });
    if (!counted && lines.length) {
      const input = lines.map((l, i) => {
        const theo = Number(l.qty_theoretical);
        if (!s.validate && i % 2 === 1) return null; // session ouverte : moitié des lignes comptées
        let q = theo; let note = null;
        if (i === 1 && theo >= 2) { q = theo - 1; note = 'Unité manquante (vol présumé)'; }
        if (i === 4) { q = theo + 2; note = 'Colis retrouvé en réserve'; }
        if (i === 7 && theo >= 1) { q = theo - 1; note = 'Produit endommagé écarté'; }
        return { id: l.id, qty_counted: q, note };
      }).filter(Boolean);
      await countSvc.saveLines(req, session.id, { lines: input });
    }
    if (s.validate) {
      try { await countSvc.validate(req, session.id); } catch (e) { ctx.warn(`Validation comptage ${s.node} : ${e.message}`); }
    }
  }
}

module.exports = { name: 'stock', label: 'Ajustements et comptages', run };
