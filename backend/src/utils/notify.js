/**
 * Notification utility — logs events to the notifications table.
 * Extend this with real push/SMS/email providers as needed.
 */
const prisma = require('../config/database');

// Template library (extend as needed)
const TEMPLATES = {
  order_confirmed: {
    title: 'Commande confirmée',
    body: (data) => `Votre commande a été confirmée. Référence: ${data.ref}`,
  },
  order_ready: {
    title: 'Commande prête',
    body: (data) => data.delivery === 'pickup'
      ? `Votre commande est prête à être retirée au magasin.`
      : `Votre commande est prête — livraison en cours de planification.`,
  },
  order_in_delivery: {
    title: 'En cours de livraison',
    body: (_) => `Votre commande est en cours de livraison. Notre livreur est en route.`,
  },
  order_delivered: {
    title: 'Commande livrée',
    body: (data) => `Votre commande a été livrée. Merci pour votre confiance ! ${data.points > 0 ? `Vous avez gagné ${data.points} points fidélité.` : ''}`,
  },
  order_cancelled: {
    title: 'Commande annulée',
    body: (data) => `Votre commande a été annulée.${data.reason ? ' Raison: ' + data.reason : ''}`,
  },
  wallet_credited: {
    title: 'Wallet rechargé',
    body: (data) => `Votre wallet a été rechargé de ${data.amount} MAD. Nouveau solde: ${data.balance} MAD.`,
  },
  wallet_debited: {
    title: 'Paiement wallet',
    body: (data) => `Paiement de ${data.amount} MAD effectué depuis votre wallet. Solde restant: ${data.balance} MAD.`,
  },
  flash_sale_created: {
    title: 'Promotion spéciale',
    body: (data) => `Profitez de ${data.discount_label} sur ${data.scope_label}${data.until ? ` jusqu'au ${data.until}` : ''}.`,
  },
  pack_created: {
    title: 'Nouveau pack disponible',
    body: (data) => `Découvrez le pack "${data.name}" à ${data.price} MAD${data.discount_pct ? ` (-${data.discount_pct}%)` : ''}.`,
  },
  coupon_created: {
    title: 'Nouveau code promo',
    body: (data) => {
      const label = data.type === 'PERCENTAGE'    ? `-${data.value}% sur votre commande`
                  : data.type === 'FIXED'          ? `-${data.value} MAD sur votre commande`
                  : data.type === 'FREE_SHIPPING'  ? 'Livraison gratuite'
                  : 'Réduction spéciale';
      return `${label} avec le code ${data.code}${data.min_order_amount > 0 ? ` dès ${data.min_order_amount} MAD d'achat` : ''}.`;
    },
  },
};

// ── Core notify function ───────────────────────────────────────────────────────
async function notify({ customer_id, order_id, event_code, data = {}, channel_code = 'app' }) {
  if (!customer_id || !event_code) return;

  try {
    const [channel, customer] = await Promise.all([
      prisma.notificationChannel.findFirst({ where: { code: channel_code } }),
      prisma.customer.findUnique({ where: { id: customer_id }, select: { id: true, phone_number: true } }),
    ]);
    if (!customer) return;

    const tpl = TEMPLATES[event_code];
    const title = tpl?.title ?? event_code;
    const body  = tpl ? tpl.body(data) : JSON.stringify(data);

    await prisma.notification.create({
      data: {
        customer_id,
        order_id:   order_id  || null,
        channel_id: channel?.id || null,
        event_code,
        title_fr:   title,
        body_fr:    body,
        metadata:   data,
      },
    });

    // TODO: send real push notification / SMS here
    // e.g. sendPush(customer.push_token, title, body);
    // e.g. sendSMS(customer.phone_number, body);

  } catch (err) {
    // Notifications must never break the main flow
    console.warn('[notify] error:', err.message);
  }
}

// ── Convenience wrappers ───────────────────────────────────────────────────────
const notifyOrderConfirmed = (customer_id, order_id, ref)       => notify({ customer_id, order_id, event_code: 'order_confirmed', data: { ref } });
const notifyOrderReady     = (customer_id, order_id, delivery)  => notify({ customer_id, order_id, event_code: 'order_ready', data: { delivery } });
const notifyInDelivery     = (customer_id, order_id)            => notify({ customer_id, order_id, event_code: 'order_in_delivery' });
const notifyDelivered      = (customer_id, order_id, points=0)  => notify({ customer_id, order_id, event_code: 'order_delivered', data: { points } });
const notifyCancelled      = (customer_id, order_id, reason)    => notify({ customer_id, order_id, event_code: 'order_cancelled', data: { reason } });
const notifyWalletCredited = (customer_id, amount, balance)     => notify({ customer_id, event_code: 'wallet_credited', data: { amount, balance } });
const notifyWalletDebited  = (customer_id, amount, balance)     => notify({ customer_id, event_code: 'wallet_debited', data: { amount, balance } });

// ── Broadcast (all customers) ──────────────────────────────────────────────────
async function notifyAllCustomers(event_code, data = {}) {
  try {
    const [customers, channel] = await Promise.all([
      prisma.customer.findMany({ where: { is_active: true }, select: { id: true } }),
      prisma.notificationChannel.findFirst({ where: { code: 'app' } }),
    ]);
    if (!customers.length) return;

    const tpl   = TEMPLATES[event_code];
    const title = tpl?.title ?? event_code;
    const body  = tpl ? tpl.body(data) : JSON.stringify(data);

    await prisma.notification.createMany({
      data: customers.map(c => ({
        customer_id: c.id,
        channel_id:  channel?.id || null,
        event_code,
        title_fr:    title,
        body_fr:     body,
        metadata:    data,
      })),
    });
  } catch (err) {
    console.warn('[notify] broadcast error:', err.message);
  }
}

const notifyFlashSaleCreated = (discount_label, scope_label, until) =>
  notifyAllCustomers('flash_sale_created', { discount_label, scope_label, until });

const notifyPackCreated = (name, price, discount_pct) =>
  notifyAllCustomers('pack_created', { name, price, discount_pct });

// Personal coupon (customer_id set) → notify just that customer.
// Public coupon (customer_id null) → broadcast to every active customer.
const notifyCouponCreated = (customer_id, { code, type, value, min_order_amount }) => {
  const data = { code, type, value, min_order_amount };
  return customer_id
    ? notify({ customer_id, event_code: 'coupon_created', data })
    : notifyAllCustomers('coupon_created', data);
};

// ── List notifications (customer-facing) ──────────────────────────────────────
async function listNotifications(customer_id, { limit = 30, unread_only = false } = {}) {
  const where = { customer_id, ...(unread_only ? { is_read: false } : {}) };
  const notifs = await prisma.notification.findMany({
    where,
    orderBy: { sent_at: 'desc' },
    take: Number(limit),
  });
  return notifs;
}

async function markRead(customer_id, notification_id) {
  const n = await prisma.notification.findFirst({ where: { id: notification_id, customer_id } });
  if (!n) throw { statusCode: 404, message: 'Notification introuvable' };
  return prisma.notification.update({ where: { id: notification_id }, data: { is_read: true } });
}

async function markAllRead(customer_id) {
  await prisma.notification.updateMany({ where: { customer_id, is_read: false }, data: { is_read: true } });
  return { ok: true };
}

async function deleteNotification(customer_id, notification_id) {
  const n = await prisma.notification.findFirst({ where: { id: notification_id, customer_id } });
  if (!n) throw { statusCode: 404, message: 'Notification introuvable' };
  await prisma.notification.delete({ where: { id: notification_id } });
  return { ok: true };
}

async function deleteAllNotifications(customer_id) {
  await prisma.notification.deleteMany({ where: { customer_id } });
  return { ok: true };
}

module.exports = {
  notify,
  notifyOrderConfirmed, notifyOrderReady, notifyInDelivery, notifyDelivered,
  notifyCancelled, notifyWalletCredited, notifyWalletDebited,
  notifyAllCustomers, notifyFlashSaleCreated, notifyPackCreated, notifyCouponCreated,
  listNotifications, markRead, markAllRead, deleteNotification, deleteAllNotifications,
};
