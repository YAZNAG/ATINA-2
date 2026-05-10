const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const svc = require('../src/modules/checkout/checkout.service');

async function main() {
  console.log('🧪 Test createOrder\n');

  // Pick Rabat customer + address
  const customer = await p.customer.findFirst({ where: { city: 'Rabat', is_deleted: false, is_active: true } });
  const address  = await p.address.findFirst({ where: { customer_id: customer.id, is_deleted: false } });
  const article  = await p.article.findFirst({ where: { is_deleted: false, is_active: true, sku_uuid: { not: null } } });
  const homeType = await p.deliveryType.findFirst({ where: { code: 'home' } });
  const codMethod= await p.paymentMethod.findFirst({ where: { code: 'cod' } });

  console.log(`Client:   ${customer.name} (${customer.city})`);
  console.log(`Adresse:  ${address.street_name}, ${address.city}`);
  console.log(`Article:  ${article.name_fr} — SKU: ${article.sku_uuid}`);
  console.log(`Livraison: ${homeType.code}`);
  console.log(`Paiement: ${codMethod.code}\n`);

  // Step 1: get slots → get node_id
  console.log('── Step 1: getDeliverySlots');
  const slotsResult = await svc.getDeliverySlots(address.id, homeType.id, [], null);
  if (!slotsResult.node) { console.log('❌ No node found:', slotsResult.message); return; }
  console.log(`  Node: ${slotsResult.node.name_fr} (${slotsResult.node.id})`);
  console.log(`  Slots: ${slotsResult.slots?.length}`);
  const slot = slotsResult.slots?.[0];
  if (slot) console.log(`  First slot: ${slot.slot_start}–${slot.slot_end}`);

  // Step 2: createOrder with explicit node_id
  console.log('\n── Step 2: createOrder');
  try {
    const order = await svc.createOrder({
      customer_id:       customer.id,
      address_id:        address.id,
      delivery_type_id:  homeType.id,
      node_id:           slotsResult.node.id,   // ← explicit from step 1
      selected_slot_id:  slot?.id ?? null,
      payment_method_id: codMethod.id,
      cart_items: [
        { sku_id: article.sku_uuid, qty: 1, unit_price: Number(article.price), vat_rate: Number(article.vat_rate) },
      ],
      notes: 'Test back-office',
    });
    console.log(`  ✅ Order created: ${order.id}`);
    console.log(`  Status: ${order.status?.code} — Total: ${order.total_ttc} MAD`);
    console.log(`  Node: ${order.node?.name_fr}`);
    console.log(`  Items: ${order.items?.length}`);

    // Cleanup: delete test order
    await p.payment.deleteMany({ where: { order_id: order.id } });
    await p.orderItem.deleteMany({ where: { order_id: order.id } });
    await p.order.delete({ where: { id: order.id } });
    console.log('\n  🧹 Test order cleaned up');
  } catch (err) {
    console.log('  ❌ Error:', err.message ?? err);
    if (err.debug) console.log('  Debug:', err.debug);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
