/**
 * Étape « entrepot » : 30 emplacements par node (allée / rayon / niveau, par zone)
 * et emplacement principal de chaque SKU actif (sku_node_locations).
 */
const LAYOUT = [
  // [zone, allées, rayons, niveaux]
  ['AMB', ['A', 'B', 'C'], 3, ['N1', 'N2']],
  ['FRAIS', ['F'], 3, ['N1', 'N2']],
  ['SURG', ['S'], 2, ['N1']],
  ['RES', ['R'], 2, ['N0', 'N1']],
];

const label = (aisle, shelf, level) => `${aisle}-${String(shelf).padStart(2, '0')}-${level}`;

async function run(ctx) {
  const { prisma } = ctx;
  const [nodes, zones, levels, skus] = await Promise.all([ctx.nodes(), ctx.byCode('zone'), ctx.byCode('level'), ctx.skus()]);
  const active = skus.filter((s) => s.status === 'active');

  for (const node of nodes) {
    const byZone = {};
    for (const [zone, aisles, shelves, lvls] of LAYOUT) {
      byZone[zone] = [];
      for (const aisle of aisles) {
        for (let shelf = 1; shelf <= shelves; shelf += 1) {
          for (const lv of lvls) {
            const row = await ctx.ensure('warehouseLocation',
              { node_id: node.id, aisle, shelf: String(shelf), level_id: levels[lv]?.id },
              { node_id: node.id, aisle, shelf: String(shelf), level_id: levels[lv]?.id, zone_id: zones[zone]?.id, label: label(aisle, shelf, lv), is_active: true },
              { table: 'locations' });
            if (row) byZone[zone].push(row);
          }
        }
      }
    }
    if (ctx.dry) { ctx.count('sku_node_locations', active.length); continue; }
    const counters = { AMB: 0, FRAIS: 0, SURG: 0 };
    for (const s of active) {
      const zone = s.cons;
      const locs = byZone[zone];
      const loc = locs[counters[zone] % locs.length];
      counters[zone] += 1;
      const existing = await prisma.skuNodeLocation.findFirst({ where: { sku_id: s.id, node_id: node.id, is_primary_location: true } });
      if (existing) continue;
      await prisma.skuNodeLocation.create({ data: { sku_id: s.id, node_id: node.id, location_id: loc.id, is_primary_location: true, is_active: true, qty_physical: 0 } });
      ctx.count('sku_node_locations');
    }
  }
}

module.exports = { name: 'entrepot', label: 'Emplacements et mapping SKU → emplacement', run };
