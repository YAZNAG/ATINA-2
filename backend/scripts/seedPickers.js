/**
 * seedPickers.js — Crée des pickers démo pour chaque node actif
 * Run: node scripts/seedPickers.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

const PICKERS_PER_NODE = [
  { name: 'Ahmed Belhaj',    phone: '0701111111' },
  { name: 'Fatima Ouhssain', phone: '0702222222' },
];

async function main() {
  console.log('👷 Seed pickers démo\n');
  const nodes = await p.node.findMany({ where: { is_active: true, is_deleted: false }, select: { id: true, code: true, name_fr: true } });
  const hash  = await bcrypt.hash('picker123', 10);
  let created = 0;

  for (const node of nodes) {
    for (const tpl of PICKERS_PER_NODE) {
      const phone = tpl.phone.replace(/^0/, '');
      const existing = await p.picker.findFirst({ where: { phone_number: phone, phone_country: '+212', is_deleted: false } });
      if (existing) continue;
      await p.picker.create({
        data: { node_id: node.id, phone_country: '+212', phone_number: phone, name: tpl.name, password_hash: hash, is_active: true },
      });
      created++;
      console.log(`  ✓ ${tpl.name} → ${node.code}`);
    }
  }
  const total = await p.picker.count({ where: { is_deleted: false } });
  console.log(`\n✅ ${created} pickers créés (total: ${total})`);
  console.log('   Login: +212 / 0701111111 / picker123');
}

main().catch(console.error).finally(() => p.$disconnect());
