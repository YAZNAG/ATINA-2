/**
 * patchOrderSlots.js — Assigne un créneau de livraison aux commandes qui n'en ont pas
 * Run: node scripts/patchOrderSlots.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('🕐 Patch créneaux livraison sur commandes existantes\n');

  const orders = await p.order.findMany({
    where: { is_deleted: false, confirmed_slot_id: null },
    select: { id: true, node_id: true, created_at: true },
  });

  console.log(`Commandes sans créneau: ${orders.length}`);
  let patched = 0;

  for (const order of orders) {
    // Find any active slot for this node
    const slot = await p.deliverySlot.findFirst({
      where: { node_id: order.node_id, is_active: true },
      orderBy: { day_of_week: 'asc' },
    });

    if (!slot) {
      console.log(`  ⚠ No slot for node ${order.node_id}`);
      continue;
    }

    await p.order.update({
      where: { id: order.id },
      data:  { confirmed_slot_id: slot.id },
    });

    patched++;
    console.log(`  ✓ ${order.id.slice(0, 8)}… → ${slot.name_fr} ${slot.slot_start}–${slot.slot_end}`);
  }

  console.log(`\n✅ ${patched}/${orders.length} commandes patchées`);
}

main().catch(console.error).finally(() => p.$disconnect());
