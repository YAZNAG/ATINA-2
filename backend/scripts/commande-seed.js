const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Création de la commande...');

  // =========================================================
  // 1. CUSTOMER
  // =========================================================

  const customer = await prisma.customer.findUnique({
    where: {
      referral_code: 'TESTCUSTOMER01',
    },
    include: {
      user: true,
    },
  });

  if (!customer) {
    throw new Error(
      '❌ Customer TESTCUSTOMER01 introuvable. Lance d’abord le customer seed.'
    );
  }

  console.log(`✅ Customer trouvé : ${customer.name} (${customer.id})`);

  // =========================================================
  // 2. NODE
  // =========================================================

  const node = await prisma.node.findFirst({
    where: {
      is_active: true,
      is_deleted: false,
    },
  });

  if (!node) {
    throw new Error(
      '❌ Aucun Node actif trouvé dans la base de données.'
    );
  }

  console.log(`✅ Node trouvé : ${node.name_fr} (${node.id})`);

  // =========================================================
  // 3. ORDER STATUS
  // =========================================================

  let orderStatus = await prisma.orderStatus.findFirst({
    where: {
      code: 'PENDING',
    },
  });

  // Si pending n'existe pas, on prend le premier statut
  if (!orderStatus) {
    orderStatus = await prisma.orderStatus.findFirst({
      orderBy: {
        sort_order: 'asc',
      },
    });
  }

  if (!orderStatus) {
    throw new Error(
      '❌ Aucun OrderStatus trouvé dans la base de données.'
    );
  }

  console.log(
    `✅ OrderStatus trouvé : ${orderStatus.code} (${orderStatus.id})`
  );

  // =========================================================
  // 4. DELIVERY TYPE
  // =========================================================

  let deliveryType = await prisma.deliveryType.findFirst({
    where: {
      code: 'HOME_DELIVERY',
    },
  });

  // Si home_delivery n'existe pas, on prend le premier
  if (!deliveryType) {
    deliveryType = await prisma.deliveryType.findFirst();
  }

  if (!deliveryType) {
    throw new Error(
      '❌ Aucun DeliveryType trouvé dans la base de données.'
    );
  }

  console.log(
    `✅ DeliveryType trouvé : ${deliveryType.code} (${deliveryType.id})`
  );

  // =========================================================
  // 5. ORDER ITEM STATUS
  // =========================================================

  let orderItemStatus = await prisma.orderItemStatus.findFirst({
    where: {
      code: 'PENDING',
    },
  });

  // Si pending n'existe pas, on prend le premier
  if (!orderItemStatus) {
    orderItemStatus = await prisma.orderItemStatus.findFirst();
  }

  if (!orderItemStatus) {
    throw new Error(
      '❌ Aucun OrderItemStatus trouvé dans la base de données.'
    );
  }

  console.log(
    `✅ OrderItemStatus trouvé : ${orderItemStatus.code} (${orderItemStatus.id})`
  );

  // =========================================================
  // 6. SKU
  // =========================================================

  const sku = await prisma.sku.findFirst({
    where: {
      is_active: true,
      is_deleted: false,
    },
    orderBy: {
      created_at: 'asc',
    },
  });

  if (!sku) {
    throw new Error(
      '❌ Aucun SKU actif trouvé dans la base de données.'
    );
  }

  console.log(
    `✅ SKU trouvé : ${sku.name_fr} (${sku.sku_code})`
  );

  // =========================================================
  // 7. CALCULS
  // =========================================================

  const qty = 2;

  const unitPrice = Number(sku.price);
  const vatRate = Number(sku.vat_rate);

  const subtotalTtc = unitPrice * qty;

  // Prix TTC -> HT
  const subtotalHt =
    subtotalTtc / (1 + vatRate / 100);

  const vatAmount =
    subtotalTtc - subtotalHt;

  const deliveryFee = 20;
  const discountAmount = 0;
  const walletUsed = 0;

  const totalTtc =
    subtotalTtc +
    deliveryFee -
    discountAmount -
    walletUsed;

  // =========================================================
  // 8. CREATION ORDER + ORDER ITEM
  // =========================================================

  const order = await prisma.order.create({
    data: {
      customer_id: customer.id,
      node_id: node.id,
      status_id: orderStatus.id,
      delivery_type_id: deliveryType.id,

      currency: 'MAD',

      subtotal_ht: subtotalHt.toFixed(2),
      vat_amount: vatAmount.toFixed(2),
      delivery_fee: deliveryFee.toFixed(2),
      discount_amount: discountAmount.toFixed(2),
      wallet_used: walletUsed.toFixed(2),
      total_ttc: totalTtc.toFixed(2),

      points_earned: 0,

      is_deleted: false,

      items: {
        create: {
          sku_id: sku.id,
          status_id: orderItemStatus.id,
          node_id: node.id,

          qty: qty,
          unit_price_sold: unitPrice.toFixed(2),
          discount_amount: '0',
          qty_backordered: '0',
          vat_rate: vatRate.toFixed(2),
        },
      },
    },

    include: {
      customer: true,
      node: true,
      status: true,
      delivery_type: true,
      items: {
        include: {
          sku: true,
          status: true,
        },
      },
    },
  });

  // =========================================================
  // 9. AFFICHAGE
  // =========================================================

  console.log('\n========================================');
  console.log('✅ ORDER CREATED SUCCESSFULLY');
  console.log('========================================');

  console.log(`Order ID       : ${order.id}`);
  console.log(`Customer       : ${order.customer.name}`);
  console.log(`Node           : ${order.node.name_fr}`);
  console.log(`Status         : ${order.status.code}`);
  console.log(`Delivery Type  : ${order.delivery_type.code}`);
  console.log(`Subtotal HT    : ${order.subtotal_ht} MAD`);
  console.log(`VAT            : ${order.vat_amount} MAD`);
  console.log(`Delivery       : ${order.delivery_fee} MAD`);
  console.log(`Total TTC      : ${order.total_ttc} MAD`);

  console.log('\nItems:');

  for (const item of order.items) {
    console.log(
      `- ${item.sku.name_fr} | Qty: ${item.qty} | Price: ${item.unit_price_sold} MAD`
    );
  }

  console.log('========================================\n');
}

main()
  .catch((error) => {
    console.error('\n❌ SEED ERROR');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });