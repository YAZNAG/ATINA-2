/**
 * Stripe payment service — TEST MODE only.
 * Card: 4242 4242 4242 4242 / future date / any CVC
 *
 * Flow:
 *  1. Client calls POST /api/payment/stripe/create-intent → gets client_secret
 *  2. Flutter uses flutter_stripe to confirm payment on device
 *  3. Stripe sends webhook → backend updates payment status to 'collected'
 *
 * OR (simpler, web-based):
 *  1. Client calls POST /api/payment/stripe/create-session → gets checkout_url
 *  2. Client opens checkout_url in browser/webview
 *  3. Stripe redirects to success_url → backend updates via webhook
 */
const Stripe = require('stripe');
const prisma  = require('../../../config/database');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('REPLACE')) throw { statusCode: 500, message: 'STRIPE_SECRET_KEY non configurée' };
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

// ── Create Payment Intent (mobile SDK flow) ────────────────────────────────────
async function createPaymentIntent(order_id) {
  const stripe = getStripe();

  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: {
      customer: { select: { id: true, name: true, phone_number: true } },
      payments: { include: { payment_method: true, status: true } },
    },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

  const payment = order.payments?.[0];
  if (!payment) throw { statusCode: 422, message: 'Aucun paiement enregistré pour cette commande' };
  if (payment.status?.code === 'collected') throw { statusCode: 422, message: 'Paiement déjà encaissé' };

  // Check if a payment intent already exists in metadata
  const meta = payment.metadata ?? {};
  if (meta.stripe_payment_intent_id) {
    // Retrieve existing intent
    try {
      const existing = await stripe.paymentIntents.retrieve(meta.stripe_payment_intent_id);
      if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(existing.status)) {
        return { client_secret: existing.client_secret, payment_intent_id: existing.id };
      }
    } catch (_) {}
  }

  const amountCents = Math.round(Number(payment.amount) * 100); // Stripe uses cents

  const intent = await stripe.paymentIntents.create({
    amount:   amountCents,
    currency: (payment.currency ?? 'mad').toLowerCase(),
    metadata: {
      order_id,
      payment_id:   payment.id,
      customer_id:  order.customer_id,
      customer_name: order.customer?.name,
    },
    description: `Commande Dark Store #${order_id.slice(0, 8)}`,
  });

  // Store intent ID in payment metadata
  await prisma.payment.update({
    where: { id: payment.id },
    data:  { metadata: { ...meta, stripe_payment_intent_id: intent.id } },
  });

  return { client_secret: intent.client_secret, payment_intent_id: intent.id };
}

// ── Create Checkout Session (hosted page — simpler for web) ───────────────────
async function createCheckoutSession(order_id, success_url, cancel_url) {
  const stripe = getStripe();

  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: {
      customer: { select: { id: true, name: true } },
      payments: { include: { payment_method: true, status: true } },
      items:    { include: { sku: { select: { article: { select: { name_fr: true } } } } } },
    },
  });
  if (!order) throw { statusCode: 404, message: 'Commande introuvable' };

  const payment = order.payments?.[0];
  if (!payment) throw { statusCode: 422, message: 'Aucun paiement enregistré' };
  if (payment.status?.code === 'collected') throw { statusCode: 422, message: 'Paiement déjà encaissé' };

  const amountCents = Math.round(Number(payment.amount) * 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: (payment.currency ?? 'mad').toLowerCase(),
        product_data: { name: `Commande Dark Store #${order_id.slice(0, 8)}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    success_url: success_url || `${process.env.CLIENT_URL}/checkout/success/${order_id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  cancel_url  || `${process.env.CLIENT_URL}/checkout/${order_id}?cancelled=1`,
    metadata: { order_id, payment_id: payment.id, customer_id: order.customer_id },
  });

  // Store session ID in metadata
  const meta = payment.metadata ?? {};
  await prisma.payment.update({
    where: { id: payment.id },
    data:  { metadata: { ...meta, stripe_session_id: session.id } },
  });

  return { checkout_url: session.url, session_id: session.id };
}

// ── Handle webhook events ─────────────────────────────────────────────────────
async function handleWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.includes('REPLACE')) {
    console.warn('[stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    // Parse raw body as JSON for development
    const event = JSON.parse(rawBody.toString());
    return processEvent(event);
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw { statusCode: 400, message: `Webhook signature invalide: ${err.message}` };
  }
  return processEvent(event);
}

async function processEvent(event) {
  console.log(`[stripe] event: ${event.type}`);

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    await _markPaymentCollected(intent.metadata?.payment_id, intent.metadata?.order_id, intent.id);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await _markPaymentCollected(session.metadata?.payment_id, session.metadata?.order_id, session.payment_intent);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    await _markPaymentFailed(intent.metadata?.payment_id);
  }

  return { received: true };
}

async function _markPaymentCollected(payment_id, order_id, stripe_ref) {
  if (!payment_id) return;
  const collectedStatus = await prisma.paymentStatus.findFirst({ where: { code: 'collected' } });
  if (!collectedStatus) return;

  await prisma.payment.update({
    where: { id: payment_id },
    data:  {
      status_id: collectedStatus.id,
      metadata: { stripe_payment_ref: stripe_ref },
    },
  });

  console.log(`[stripe] payment ${payment_id} marked as collected (order ${order_id})`);
}

async function _markPaymentFailed(payment_id) {
  if (!payment_id) return;
  const failedStatus = await prisma.paymentStatus.findFirst({ where: { code: 'failed' } });
  if (!failedStatus) return;
  await prisma.payment.update({ where: { id: payment_id }, data: { status_id: failedStatus.id } });
  console.log(`[stripe] payment ${payment_id} marked as failed`);
}

// ── Get Stripe public key (for frontend) ──────────────────────────────────────
function getPublicKey() {
  const key = process.env.STRIPE_PUBLIC_KEY;
  if (!key || key.includes('REPLACE')) return null;
  return key;
}

module.exports = { createPaymentIntent, createCheckoutSession, handleWebhook, getPublicKey };
