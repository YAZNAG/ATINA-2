/**
 * Étape « creneaux » : créneaux de livraison datés pour chaque node, des 30 derniers
 * jours (historique des commandes) aux 14 prochains jours, 3 à 5 plages par jour.
 */
const { SLOT_TEMPLATES } = require('../data/people.data');

const PERIOD = (start) => {
  const h = Number(start.slice(0, 2));
  if (h < 12) return ['Matin', 'الصباح'];
  if (h < 17) return ['Après-midi', 'بعد الظهر'];
  return ['Soirée', 'المساء'];
};

async function run(ctx) {
  const { prisma } = ctx;
  const nodes = await ctx.nodes();
  const today = new Date();
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (const node of nodes) {
    const tpl = SLOT_TEMPLATES[node.code];
    const hours = node.opening_hours_json || {};
    const existing = await prisma.deliverySlot.findMany({ where: { node_id: node.id }, select: { specific_date: true, slot_start: true } });
    const seen = new Set(existing.map((s) => `${s.specific_date.toISOString().slice(0, 10)}|${s.slot_start}`));
    const rows = [];
    for (let d = -30; d < 14; d += 1) {
      const date = new Date(base + d * 86400000);
      const dow = String(date.getUTCDay());
      if (hours[dow] && hours[dow].open === false) continue;
      for (const [start, end, max] of tpl) {
        const key = `${date.toISOString().slice(0, 10)}|${start}`;
        if (seen.has(key)) continue;
        const [fr, ar] = PERIOD(start);
        rows.push({ node_id: node.id, specific_date: date, slot_start: start, slot_end: end, max_orders: max, is_active: true, name_fr: `${fr} ${start}–${end}`, name_ar: `${ar} ${start}–${end}` });
      }
    }
    ctx.count('delivery_slots', rows.length);
    if (!ctx.dry && rows.length) await prisma.deliverySlot.createMany({ data: rows });
  }
}

module.exports = { name: 'creneaux', label: 'Créneaux de livraison', run };
