/**
 * testCheckout.js — Validation end-to-end du module checkout
 * Run: node scripts/testCheckout.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const svc = require('../src/modules/checkout/checkout.service');

async function main() {
  console.log('🧪 Test checkout\n');

  // Pick a customer with address in Rabat
  const customer = await p.customer.findFirst({
    where: { city: 'Rabat', is_deleted: false, is_active: true },
    select: { id: true, name: true, city: true },
  });
  if (!customer) { console.log('❌ No Rabat customer'); return; }
  console.log(`Client: ${customer.name} — ${customer.city}`);

  // Pick their first address
  const address = await p.address.findFirst({
    where: { customer_id: customer.id, is_deleted: false },
    select: { id: true, street_name: true, city: true, lat: true, lng: true },
  });
  if (!address) { console.log('❌ No address'); return; }
  console.log(`Adresse: ${address.street_name}, ${address.city}\n`);

  // Pick delivery type "home"
  const homeType = await p.deliveryType.findFirst({ where: { code: 'home' } });
  if (!homeType) { console.log('❌ delivery_type home not found'); return; }

  // Test 1: eligible nodes (no cart)
  console.log('── Test 1: findEligibleNodes (panier vide)');
  const result = await svc.findEligibleNodes(address.id, [], new Date());
  console.log(`  Eligible: ${result.eligible.length}, Ineligible: ${result.ineligible.length}`);
  if (result.best_node) console.log(`  Best node: ${result.best_node.name_fr} (${result.best_node.distance_km ?? '?'} km)`);
  else console.log('  ⚠ Aucun node éligible');

  // Test 2: getDeliverySlots
  console.log('\n── Test 2: getDeliverySlots');
  const slots = await svc.getDeliverySlots(address.id, homeType.id, [], null);
  if (slots.node) {
    console.log(`  Node: ${slots.node.name_fr}`);
    console.log(`  Créneaux disponibles: ${slots.slots?.length ?? 0}`);
    if (slots.slots?.length) console.log(`  Premier créneau: ${slots.slots[0].slot_start}–${slots.slots[0].slot_end} (${slots.slots[0].name_fr})`);
  } else {
    console.log(`  ⚠ ${slots.message}`);
  }

  console.log('\n✅ Test terminé');
}

main().catch(e => { console.error('❌ Erreur:', e.message || e); }).finally(() => p.$disconnect());
