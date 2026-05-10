const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const [nodes, customers, cities, nodeTypes, deliverySlots] = await Promise.all([
    p.node.findMany({ where: { is_deleted: false }, select: { id: true, name_fr: true, code: true, is_active: true, city_id: true, lat: true, lng: true, delivery_radius_km: true, max_daily_orders: true }, take: 10 }),
    p.customer.findMany({ where: { is_deleted: false }, select: { id: true, name: true, city: true }, take: 10 }),
    p.city.findMany({ where: { is_active: true, is_deleted: false }, select: { id: true, name_fr: true, postal_code: true }, orderBy: { name_fr: 'asc' }, take: 30 }),
    p.nodeType.findMany({ select: { id: true, code: true, name_fr: true }, take: 5 }),
    p.deliverySlot.findMany({ select: { id: true, node_id: true, name_fr: true, day_of_week: true, slot_start: true, slot_end: true, is_active: true }, take: 10 }),
  ]);

  console.log('=== NODES ===', nodes.length);
  console.log(JSON.stringify(nodes, null, 2));

  console.log('\n=== CUSTOMER CITIES ===');
  console.log(JSON.stringify(customers.map(c => ({ name: c.name, city: c.city })), null, 2));

  console.log('\n=== CITIES IN DB ===');
  const custCities = [...new Set(customers.map(c => c.city).filter(Boolean))];
  console.log('Customer cities:', custCities);
  for (const cc of custCities) {
    const found = cities.find(c => c.name_fr === cc);
    console.log(`  "${cc}" → ${found ? `FOUND id=${found.id}` : 'NOT FOUND IN CITIES TABLE'}`);
  }

  console.log('\n=== NODE TYPES ===');
  console.log(JSON.stringify(nodeTypes, null, 2));

  console.log('\n=== DELIVERY SLOTS ===', deliverySlots.length);
  console.log(JSON.stringify(deliverySlots, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
