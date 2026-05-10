const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get exact city names for each node
  const nodes = await p.node.findMany({
    where: { is_deleted: false },
    select: { id: true, name_fr: true, code: true, city_id: true, city: { select: { id: true, name_fr: true, name_ar: true } } },
  });
  console.log('=== NODES + REAL CITY NAME ===');
  nodes.forEach(n => console.log(`  [${n.code}] "${n.name_fr}" → city_id=${n.city_id} → name_fr="${n.city?.name_fr}"`));

  // Check customer city vs DB city
  const customers = await p.customer.findMany({ where: { is_deleted: false }, select: { name: true, city: true } });
  console.log('\n=== CUSTOMER CITY vs DB MATCH ===');
  for (const c of customers) {
    const found = await p.city.findFirst({ where: { name_fr: c.city, is_active: true, is_deleted: false }, select: { name_fr: true } });
    console.log(`  ${c.name}: "${c.city}" → ${found ? '✓ match' : '✗ NO MATCH'}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
