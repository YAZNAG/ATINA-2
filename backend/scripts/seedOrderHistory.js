/**
 * seedOrderHistory.js — Initialise l'historique des commandes existantes
 * Reconstitue le pipeline depuis "pending" jusqu'au statut actuel.
 * Run: node scripts/seedOrderHistory.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Ordered pipeline (low → high)
const PIPELINE = ['pending', 'awaiting_stock', 'confirmed', 'picking', 'ready', 'in_delivery', 'delivered', 'cancelled', 'returned'];

function pipelineIndex(code) {
  const i = PIPELINE.indexOf(code);
  return i === -1 ? 999 : i;
}

async function main() {
  console.log('📋 Seed historique commandes\n');

  // Load all order statuses
  const statuses = await p.orderStatus.findMany({ select: { id: true, code: true, name_fr: true } });
  const S = Object.fromEntries(statuses.map(s => [s.code, s]));

  // Load all orders
  const orders = await p.order.findMany({
    where: { is_deleted: false },
    select: { id: true, created_at: true, updated_at: true, status: { select: { code: true, id: true } } },
  });

  console.log(`Commandes à traiter: ${orders.length}`);
  let totalEntries = 0;

  for (const order of orders) {
    // Skip if history already exists
    const existing = await p.orderHistory.count({ where: { order_id: order.id } });
    if (existing > 0) { console.log(`  ⏭  ${order.id.slice(0,8)}… (déjà historisé)`); continue; }

    const currentCode  = order.status.code;
    const currentIndex = pipelineIndex(currentCode);

    // Build the list of status steps from pending → current
    const steps = PIPELINE.filter((code, i) => {
      if (code === 'pending') return true;
      if (code === currentCode) return true;
      // Include intermediate steps for terminal statuses
      if (['cancelled', 'returned'].includes(currentCode)) return false;
      return i < currentIndex;
    });

    // Remove duplicates (e.g. awaiting_stock before confirmed)
    const uniqueSteps = [...new Set(steps)];

    // Distribute timestamps between created_at and updated_at
    const start = new Date(order.created_at).getTime();
    const end   = new Date(order.updated_at).getTime();
    const span  = end - start;
    const n     = uniqueSteps.length;

    const entries = [];
    for (let i = 0; i < n; i++) {
      const code   = uniqueSteps[i];
      const status = S[code];
      if (!status) continue;
      const ts = n === 1 ? start : start + Math.round((span * i) / (n - 1));
      entries.push({
        order_id:   order.id,
        status_id:  status.id,
        note:       i === 0 ? 'Commande créée' : null,
        created_at: new Date(ts),
      });
    }

    if (entries.length > 0) {
      await p.orderHistory.createMany({ data: entries });
      totalEntries += entries.length;
      console.log(`  ✓ ${order.id.slice(0,8)}… — ${entries.map(e => S[uniqueSteps[entries.indexOf(e)]]?.code ?? '?').join(' → ')} (${entries.length} entrées)`);
    }
  }

  console.log(`\n✅ ${totalEntries} entrées d'historique créées`);
}

main().catch(console.error).finally(() => p.$disconnect());
