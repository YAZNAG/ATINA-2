/**
 * Étape « geographie » : villes rattachées aux 12 régions, 4 nodes.
 */
const { CITIES, NODES } = require('../data/people.data');

async function run(ctx) {
  const { prisma } = ctx;
  const regions = await ctx.byCode('region');
  if (!Object.keys(regions).length) { ctx.warn('Aucune région en base : lancez src/seeders/regions.seed.js'); return; }

  const cities = {};
  for (const c of CITIES) {
    const region = regions[c.region];
    if (!region) { ctx.warn(`Région ${c.region} introuvable pour ${c.name_fr}`); continue; }
    let row = await prisma.city.findFirst({ where: { OR: [{ code: c.code }, { name_fr: { equals: c.name_fr, mode: 'insensitive' } }] } });
    if (!row) {
      ctx.count('cities');
      if (!ctx.dry) {
        row = await prisma.city.create({
          data: { code: c.code, name_fr: c.name_fr, name_ar: c.name_ar, postal_code: c.postal_code, region_id: region.id, sort_order: c.sort_order, is_active: true },
        });
      }
    }
    cities[c.code] = row;
  }

  const types = await ctx.byCode('nodeType');
  for (const n of NODES) {
    const exists = await prisma.node.findFirst({ where: { code: n.code } });
    if (exists) continue;
    ctx.count('nodes');
    if (ctx.dry) continue;
    await prisma.node.create({
      data: {
        code: n.code, name_fr: n.name_fr, name_ar: n.name_ar,
        node_type_id: types[n.type].id, region_id: regions[n.region].id, city_id: cities[n.city].id,
        address_line1: n.address_line1, quartier: n.quartier, postal_code: n.postal_code,
        lat: n.lat, lng: n.lng, phone: n.phone, timezone: 'Africa/Casablanca',
        delivery_radius_km: n.delivery_radius_km, max_daily_orders: n.max_daily_orders,
        opening_hours_json: n.opening_hours_json, delivery_fee: n.delivery_fee,
        min_order_amount: n.min_order_amount, slot_selection_enabled: n.slot_selection_enabled, is_active: true,
      },
    });
  }
}

module.exports = { name: 'geographie', label: 'Villes et nodes', run };
