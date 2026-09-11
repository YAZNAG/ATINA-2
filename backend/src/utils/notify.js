const prisma = require('../config/database');

// Template library (extend as needed)
const TEMPLATES = {
  order_confirmed: {
    title: 'Commande confirmée',
    body: (data) => `Votre commande a été confirmée. Référence: ${data.ref}`,
    title_ar: 'تم تأكيد طلبك',
    body_ar: (data) => `تم تأكيد طلبك. المرجع: ${data.ref}`,
  },
  order_ready: {
    title: 'Commande prête',
    body: (data) => data.delivery === 'pickup'
      ? `Votre commande est prête à être retirée au magasin.`
      : `Votre commande est prête — livraison en cours de planification.`,
    title_ar: 'طلبك جاهز',
    body_ar: (data) => data.delivery === 'pickup'
      ? 'طلبك جاهز للاستلام من المتجر.'
      : 'طلبك جاهز — جارٍ تخطيط التوصيل.',
  },
  order_in_delivery: {
    title: 'En cours de livraison',
    body: (_) => `Votre commande est en cours de livraison. Notre livreur est en route.`,
    title_ar: 'قيد التوصيل',
    body_ar: (_) => 'طلبك قيد التوصيل. السائق في الطريق إليك.',
  },
  order_delivered: {
    title: 'Commande livrée',
    body: (data) => `Votre commande a été livrée. Merci pour votre confiance ! ${data.points > 0 ? `Vous avez gagné ${data.points} points fidélité.` : ''}`,
    title_ar: 'تم توصيل طلبك',
    body_ar: (data) => `تم توصيل طلبك. شكرًا لثقتكم! ${data.points > 0 ? `لقد ربحت ${data.points} نقطة ولاء.` : ''}`,
  },
  order_cancelled: {
    title: 'Commande annulée',
    body: (data) => `Votre commande a été annulée.${data.reason ? ' Raison: ' + data.reason : ''}`,
    title_ar: 'تم إلغاء طلبك',
    body_ar: (data) => `تم إلغاء طلبك.${data.reason ? ' السبب: ' + data.reason : ''}`,
  },
  wallet_credited: {
    title: 'Wallet rechargé',
    body: (data) => `Votre wallet a été rechargé de ${data.amount} MAD. Nouveau solde: ${data.balance} MAD.`,
    title_ar: 'تم شحن المحفظة',
    body_ar: (data) => `تم شحن محفظتك بمبلغ ${data.amount} درهم. الرصيد الجديد: ${data.balance} درهم.`,
  },
  wallet_debited: {
    title: 'Paiement wallet',
    body: (data) => `Paiement de ${data.amount} MAD effectué depuis votre wallet. Solde restant: ${data.balance} MAD.`,
    title_ar: 'دفع من المحفظة',
    body_ar: (data) => `تم دفع ${data.amount} درهم من محفظتك. الرصيد المتبقي: ${data.balance} درهم.`,
  },
  flash_sale_created: {
    title: 'Promotion spéciale',
    body: (data) => `Profitez de ${data.discount_label} sur ${data.scope_label}${data.until ? ` jusqu'au ${data.until}` : ''}.`,
    title_ar: 'عرض خاص',
    body_ar: (data) => `استفد من ${data.discount_label} على ${data.scope_label}${data.until ? ` حتى ${data.until}` : ''}.`,
  },
  pack_created: {
    title: 'Nouveau pack disponible',
    body: (data) => `Découvrez le pack "${data.name}" à ${data.price} MAD${data.discount_pct ? ` (-${data.discount_pct}%)` : ''}.`,
    title_ar: 'باقة جديدة متوفرة',
    body_ar: (data) => `اكتشف الباقة "${data.name_ar || data.name}" بسعر ${data.price} درهم${data.discount_pct ? ` (-${data.discount_pct}%)` : ''}.`,
  },
  order_picked_up: {
    title: 'Commande retirée',
    body: (_) => `Votre commande a été retirée au magasin. Merci pour votre confiance !`,
    title_ar: 'تم استلام طلبك',
    body_ar: (_) => 'تم استلام طلبك من المتجر. شكرًا لثقتكم!',
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
    title_ar: 'رمز ترويجي جديد',
    body_ar: (data) => {
      const label = data.type === 'PERCENTAGE'    ? `-${data.value}% على طلبك`
                  : data.type === 'FIXED'          ? `-${data.value} درهم على طلبك`
                  : data.type === 'FREE_SHIPPING'  ? 'توصيل مجاني'
                  : 'تخفيض خاص';
      return `${label} بالرمز ${data.code}${data.min_order_amount > 0 ? ` ابتداءً من ${data.min_order_amount} درهم` : ''}.`;
    },
  },
};

/** Rend titre / contenu FR et AR d'un événement (AR si le modèle ou les données le fournissent). */
function render(event_code, data = {}) {
  const tpl = TEMPLATES[event_code];
  const title_fr = tpl?.title ?? event_code;
  const body_fr = tpl ? tpl.body(data) : JSON.stringify(data);
  let title_ar = data.title_ar ?? tpl?.title_ar ?? null;
  let body_ar = data.body_ar ?? null;
  if (body_ar == null && typeof tpl?.body_ar === 'function') {
    try { body_ar = tpl.body_ar(data); } catch { body_ar = null; }
  }
  if (title_ar != null) title_ar = String(title_ar).slice(0, 255);
  return { title_fr, body_fr, title_ar, body_ar };
}

// ── Référentiel notification_statuses (pending, sent, delivered, read, failed) ──
const statusCache = new Map();
async function statusId(code) {
  if (statusCache.has(code)) return statusCache.get(code);
  const row = await prisma.notificationDeliveryStatus.findUnique({ where: { code }, select: { id: true } });
  const id = row?.id ?? null;
  if (id) statusCache.set(code, id);
  return id;
}

/**
 * Envoi effectif (push / SMS). Le canal « app » est une notification in-app :
 * l'écriture en base vaut envoi. Brancher ici le push / SMS réel ; toute
 * exception (ou un retour false) marque la notification « failed ».
 */
// eslint-disable-next-line no-unused-vars
async function deliver({ channel_code, customer, title, body }) {
  // TODO: sendPush(customer.push_token, title, body) / sendSMS(customer.phone_number, body)
  return true;
}

// ── Core notify function ───────────────────────────────────────────────────────
async function notify({ customer_id, order_id, event_code, data = {}, channel_code = 'app' }) {
  if (!customer_id || !event_code) return;

  try {
    const [channel, customer] = await Promise.all([
      prisma.notificationChannel.findFirst({ where: { code: channel_code } }),
      prisma.customer.findUnique({ where: { id: customer_id }, select: { id: true, phone_number: true } }),
    ]);
    if (!customer) return;

    const { title_fr, body_fr, title_ar, body_ar } = render(event_code, data);

    // Envoi puis journalisation avec le statut obtenu (sent / failed).
    let sentOk = true;
    let failure = null;
    try {
      sentOk = (await notifyTransport.deliver({ channel_code, customer, title: title_fr, body: body_fr })) !== false;
    } catch (e) {
      sentOk = false;
      failure = e?.message || String(e);
    }
    const status_id = await statusId(sentOk ? 'sent' : 'failed');

    await prisma.notification.create({
      data: {
        customer_id,
        order_id:   order_id  || null,
        channel_id: channel?.id || null,
        event_code,
        title_fr,
        body_fr,
        title_ar,
        body_ar,
        status_id,
        metadata:   failure ? { ...data, delivery_error: failure } : data,
      },
    });
  } catch (err) {
    // Notifications must never break the main flow
    console.error('[notify] FULL ERROR:', err);
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
const notifyPickedUp = (customer_id, order_id) =>
  notify({ customer_id, order_id, event_code: 'order_picked_up' });

// ── Broadcast (all customers) ──────────────────────────────────────────────────
async function notifyAllCustomers(event_code, data = {}) {
  try {
    const [customers, channel] = await Promise.all([
      prisma.customer.findMany({ where: { is_active: true }, select: { id: true } }),
      prisma.notificationChannel.findFirst({ where: { code: 'app' } }),
    ]);
    if (!customers.length) return;

    const { title_fr, body_fr, title_ar, body_ar } = render(event_code, data);
    const sentId = await statusId('sent');

    await prisma.notification.createMany({
      data: customers.map(c => ({
        customer_id: c.id,
        channel_id:  channel?.id || null,
        event_code,
        title_fr,
        body_fr,
        title_ar,
        body_ar,
        status_id:   sentId,
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

// Lecture par le client : is_read + read_at (première lecture) + statut « read ».
async function markRead(customer_id, notification_id) {
  const n = await prisma.notification.findFirst({ where: { id: notification_id, customer_id } });
  if (!n) throw { statusCode: 404, message: 'Notification introuvable' };
  if (n.is_read && n.read_at) return n;
  const readId = await statusId('read');
  return prisma.notification.update({
    where: { id: notification_id },
    data: { is_read: true, read_at: n.read_at ?? new Date(), ...(readId && { status_id: readId }) },
  });
}

async function markAllRead(customer_id) {
  const readId = await statusId('read');
  await prisma.notification.updateMany({
    where: { customer_id, OR: [{ is_read: false }, { read_at: null }] },
    data: { is_read: true, read_at: new Date(), ...(readId && { status_id: readId }) },
  });
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

// Transport remplaçable (tests / branchement push-SMS) : notifyTransport.deliver = async (...) => bool.
const notifyTransport = { deliver };

module.exports = {
  notify,
  render,
  notifyTransport,
  notifyOrderConfirmed, notifyOrderReady, notifyInDelivery, notifyDelivered,
  notifyCancelled, notifyWalletCredited, notifyWalletDebited,
  notifyAllCustomers, notifyFlashSaleCreated, notifyPackCreated, notifyCouponCreated,
  listNotifications, markRead, markAllRead, deleteNotification, deleteAllNotifications,
};
