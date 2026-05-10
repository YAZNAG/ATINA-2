/**
 * seedOrders.js — Crée des commandes démo réalistes
 * Run: node scripts/seedOrders.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('🛒 Seed commandes démo\n');

  // ── Load references ──────────────────────────────────────────────────────────
  const [customers, articles, nodes, paymentMethod, homeType] = await Promise.all([
    p.customer.findMany({ where: { is_deleted: false, is_active: true }, include: { addresses: { where: { is_deleted: false }, take: 1 } }, take: 12 }),
    p.article.findMany({ where: { is_deleted: false, is_active: true, sku_uuid: { not: null } }, select: { sku_uuid: true, price: true, vat_rate: true, name_fr: true }, take: 15 }),
    p.node.findMany({ where: { is_active: true, is_deleted: false }, select: { id: true, name_fr: true, code: true }, take: 5 }),
    p.paymentMethod.findFirst({ where: { code: 'cod' } }),
    p.deliveryType.findFirst({ where: { code: 'home' } }),
  ]);

  // Get all needed statuses
  const statusRows = await p.orderStatus.findMany({ select: { id: true, code: true } });
  const S = Object.fromEntries(statusRows.map(s => [s.code, s.id]));

  const activeItemStatus = await p.orderItemStatus.findFirst({ where: { code: 'active' } });
  const pendingPayStatus = await p.paymentStatus.findFirst({ where: { code: 'pending' } });

  if (!S.pending || !S.confirmed || !S.picking || !activeItemStatus) {
    console.log('❌ Statuts manquants — lancez: node scripts/seedAuthSystem.js'); return;
  }

  const validCustomers = customers.filter(c => c.addresses.length > 0);
  if (!validCustomers.length) { console.log('❌ Aucun client avec adresse'); return; }
  if (!articles.length)       { console.log('❌ Aucun article'); return; }
  if (!nodes.length)          { console.log('❌ Aucun node'); return; }
  if (!homeType)              { console.log('❌ delivery_type home introuvable'); return; }

  console.log(`Customers: ${validCustomers.length}, Articles: ${articles.length}, Nodes: ${nodes.length}\n`);

  // ── Order templates ──────────────────────────────────────────────────────────
  const TEMPLATES = [
    { status: 'pending',        delivery_fee: 0,    discount: 0,   wallet: 0 },
    { status: 'confirmed',      delivery_fee: 15,   discount: 0,   wallet: 0 },
    { status: 'picking',        delivery_fee: 15,   discount: 11,  wallet: 0 },
    { status: 'in_delivery',    delivery_fee: 0,    discount: 0,   wallet: 20 },
    { status: 'delivered',      delivery_fee: 15,   discount: 0,   wallet: 0 },
    { status: 'cancelled',      delivery_fee: 0,    discount: 0,   wallet: 0 },
    { status: 'awaiting_stock', delivery_fee: 15,   discount: 5,   wallet: 0 },
    { status: 'picking',        delivery_fee: 10,   discount: 0,   wallet: 0 },
    { status: 'delivered',      delivery_fee: 0,    discount: 20,  wallet: 45 },
    { status: 'confirmed',      delivery_fee: 15,   discount: 0,   wallet: 0 },
    { status: 'in_delivery',    delivery_fee: 15,   discount: 0,   wallet: 0 },
    { status: 'pending',        delivery_fee: 0,    discount: 0,   wallet: 0 },
  ];

  let created = 0;

  for (let i = 0; i < Math.min(TEMPLATES.length, validCustomers.length); i++) {
    const tpl      = TEMPLATES[i];
    const customer = validCustomers[i % validCustomers.length];
    const address  = customer.addresses[0];
    const node     = nodes[i % nodes.length];
    const statusId = S[tpl.status];
    if (!statusId) { console.warn(`  ⚠ Status "${tpl.status}" not found`); continue; }

    // Pick 1-4 random articles for this order
    const numItems = Math.floor(Math.random() * 3) + 1;
    const orderArticles = articles.sort(() => 0.5 - Math.random()).slice(0, numItems);

    let subtotal_ht = 0;
    let vat_amount  = 0;
    const itemsData = orderArticles.map(a => {
      const qty      = Math.floor(Math.random() * 3) + 1;
      const price    = Number(a.price);
      const vat      = Number(a.vat_rate);
      const ht       = price / (1 + vat / 100);
      subtotal_ht   += ht * qty;
      vat_amount    += (price - ht) * qty;
      return {
        sku_id:          a.sku_uuid,
        status_id:       activeItemStatus.id,
        qty,
        unit_price_sold: price,
        discount_amount: 0,
        vat_rate:        vat,
        node_id:         node.id,
      };
    });

    const total_ttc = parseFloat((subtotal_ht + vat_amount + tpl.delivery_fee - tpl.discount).toFixed(2));

    try {
      // Pick a delivery slot for this node
      const slot = await p.deliverySlot.findFirst({
        where: { node_id: node.id, is_active: true },
        orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }],
      });

      const order = await p.order.create({
        data: {
          customer_id:       customer.id,
          node_id:           node.id,
          address_id:        address.id,
          status_id:         statusId,
          delivery_type_id:  homeType.id,
          confirmed_slot_id: slot?.id ?? null,
          subtotal_ht:       parseFloat(subtotal_ht.toFixed(2)),
          vat_amount:        parseFloat(vat_amount.toFixed(2)),
          delivery_fee:      tpl.delivery_fee,
          discount_amount:   tpl.discount,
          wallet_used:       tpl.wallet,
          total_ttc,
          notes:             i % 3 === 0 ? 'Sonner 2 fois, code: 1234' : null,
          items: { create: itemsData },
        },
      });

      // Payment record for non-cancelled orders
      if (tpl.status !== 'cancelled' && paymentMethod && pendingPayStatus) {
        const payStatusCode = ['delivered'].includes(tpl.status) ? 'collected' : 'pending';
        const payStatus = await p.paymentStatus.findFirst({ where: { code: payStatusCode } });
        if (payStatus) {
          await p.payment.create({
            data: {
              order_id:          order.id,
              status_id:         payStatus.id,
              payment_method_id: paymentMethod.id,
              amount:            total_ttc,
              currency:          'MAD',
            },
          });
        }
      }

      console.log(`  ✓ ${customer.name} — ${tpl.status} — ${total_ttc} MAD — ${numItems} article(s)`);
      created++;
    } catch (err) {
      console.warn(`  ⚠ Erreur pour ${customer.name}:`, err.message?.slice(0, 80));
    }
  }

  console.log(`\n✅ ${created} commandes créées`);
  const total = await p.order.count({ where: { is_deleted: false } });
  console.log(`Total commandes en base: ${total}\n`);
}

main().catch(console.error).finally(() => p.$disconnect());
