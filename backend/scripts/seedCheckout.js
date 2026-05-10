/**
 * seedCheckout.js
 * Seed delivery slots on all active nodes + fix customer city casing.
 * Run: node scripts/seedCheckout.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ── Slot templates (applied to EVERY node, EVERY day) ──────────────────────
const SLOT_TEMPLATES = [
  { name_fr: 'Matin',      name_ar: 'صباح',    slot_start: '08:00', slot_end: '12:00', max_orders: 30 },
  { name_fr: 'Après-midi', name_ar: 'بعد الظهر', slot_start: '14:00', slot_end: '18:00', max_orders: 30 },
  { name_fr: 'Soir',       name_ar: 'مساء',    slot_start: '18:00', slot_end: '22:00', max_orders: 20 },
];

const DAYS = [0, 1, 2, 3, 4, 5, 6]; // all week

async function main() {
  console.log('🚀 Seed checkout data\n');

  // ── 1. Load all active nodes ────────────────────────────────────────────────
  const nodes = await p.node.findMany({
    where: { is_active: true, is_deleted: false },
    select: { id: true, name_fr: true, code: true },
    orderBy: { code: 'asc' },
  });
  console.log(`Found ${nodes.length} active nodes\n`);

  // ── 2. Create delivery slots ────────────────────────────────────────────────
  let slotCount = 0;
  for (const node of nodes) {
    console.log(`📦 ${node.name_fr} (${node.code})`);
    for (const day of DAYS) {
      for (const tpl of SLOT_TEMPLATES) {
        const existing = await p.deliverySlot.findFirst({
          where: { node_id: node.id, day_of_week: day, slot_start: tpl.slot_start, slot_end: tpl.slot_end },
        });
        if (existing) continue; // idempotent

        await p.deliverySlot.create({
          data: {
            node_id:     node.id,
            name_fr:     tpl.name_fr,
            name_ar:     tpl.name_ar,
            day_of_week: day,
            slot_start:  tpl.slot_start,
            slot_end:    tpl.slot_end,
            max_orders:  tpl.max_orders,
            is_active:   true,
          },
        });
        slotCount++;
      }
    }
    const total = await p.deliverySlot.count({ where: { node_id: node.id, is_active: true } });
    console.log(`   ✓ ${total} slots actifs`);
  }
  console.log(`\n✅ ${slotCount} slots créés (nouveaux)\n`);

  // ── 3. Fix customer city casing (ex: "agadir" → "Agadir") ─────────────────
  console.log('🏙️  Fix customer city casing...');
  const customers = await p.customer.findMany({
    where: { is_deleted: false },
    select: { id: true, name: true, city: true },
  });

  let fixCount = 0;
  for (const c of customers) {
    if (!c.city) continue;
    // Find matching city regardless of case
    const city = await p.city.findFirst({
      where: { name_fr: { equals: c.city, mode: 'insensitive' }, is_active: true, is_deleted: false },
      select: { name_fr: true },
    });
    if (city && city.name_fr !== c.city) {
      await p.customer.update({ where: { id: c.id }, data: { city: city.name_fr } });
      console.log(`  ✓ "${c.name}": "${c.city}" → "${city.name_fr}"`);
      fixCount++;
    }
  }
  if (fixCount === 0) console.log('  ✓ Aucune correction nécessaire');

  // ── 4. Print summary ────────────────────────────────────────────────────────
  console.log('\n📊 RÉSUMÉ FINAL:');
  for (const node of nodes) {
    const city = await p.city.findFirst({ where: { id: (await p.node.findUnique({ where: { id: node.id }, select: { city_id: true } }))?.city_id }, select: { name_fr: true } });
    const slotTotal = await p.deliverySlot.count({ where: { node_id: node.id, is_active: true } });
    console.log(`  [${node.code}] ${node.name_fr} — ville: ${city?.name_fr ?? '?'} — ${slotTotal} slots`);
  }

  console.log('\n🎉 Checkout seed terminé!');
  console.log('👉 Testez avec un client de Rabat, Casablanca, Marrakech, Agadir ou Fès\n');
}

main().catch(console.error).finally(() => p.$disconnect());
