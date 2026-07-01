const prisma = require('../../config/database');
const { emitNewMessage } = require('../../socket/support.socket');

const VALID_CATEGORIES = ['ORDER', 'ACCOUNT', 'LOYALTY', 'PRODUCT', 'OTHER'];

const CONV_SELECT = {
  id:             true,
  subject:        true,
  category:       true,
  status:         true,
  order_id:       true,
  last_message_at: true,
  created_at:     true,
  assigned_agent: { select: { id: true, full_name: true } },
};

// ── Mes conversations ─────────────────────────────────────────────────────────

async function listMyConversations(customerId) {
  return prisma.supportConversation.findMany({
    where:   { customer_id: customerId },
    select:  CONV_SELECT,
    orderBy: { last_message_at: 'desc' },
  });
}

// ── Créer une conversation ────────────────────────────────────────────────────

async function createConversation(customerId, { subject, category, order_id, first_message }) {
  if (!subject?.trim())  throw { statusCode: 400, message: 'Sujet requis' };
  if (!category)         throw { statusCode: 400, message: 'Catégorie requise' };
  if (!VALID_CATEGORIES.includes(category))
    throw { statusCode: 400, message: `Catégorie invalide. Valeurs: ${VALID_CATEGORIES.join(', ')}` };
  if (!first_message?.trim()) throw { statusCode: 400, message: 'Premier message requis' };

  // Vérifier que la commande appartient bien au client si fournie
  if (order_id) {
    const order = await prisma.order.findFirst({ where: { id: order_id, customer_id: customerId } });
    if (!order) throw { statusCode: 404, message: 'Commande introuvable' };
  }

  const conv = await prisma.supportConversation.create({
    data: {
      customer_id: customerId,
      order_id:    order_id ?? null,
      subject:     subject.trim(),
      category,
      status:      'OPEN',
      messages: {
        create: {
          sender_type: 'CUSTOMER',
          sender_id:   customerId,
          content:     first_message.trim(),
          attachments: [],
        },
      },
    },
    select: { ...CONV_SELECT, messages: { orderBy: { created_at: 'asc' } } },
  });

  return conv;
}

// ── Détail d'une conversation ─────────────────────────────────────────────────

async function getMyConversation(customerId, conversationId) {
  const conv = await prisma.supportConversation.findFirst({
    where:   { id: conversationId, customer_id: customerId },
    select:  { ...CONV_SELECT, messages: { orderBy: { created_at: 'asc' } } },
  });
  if (!conv) throw { statusCode: 404, message: 'Conversation introuvable' };
  return conv;
}

// ── Envoyer un message ────────────────────────────────────────────────────────

async function sendMessage(customerId, conversationId, { content, attachments = [] }) {
  if (!content?.trim()) throw { statusCode: 400, message: 'Contenu requis' };

  const conv = await prisma.supportConversation.findFirst({
    where: { id: conversationId, customer_id: customerId },
  });
  if (!conv) throw { statusCode: 404, message: 'Conversation introuvable' };
  if (conv.status === 'CLOSED') throw { statusCode: 400, message: 'Cette conversation est fermée' };

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        conversation_id: conversationId,
        sender_type:     'CUSTOMER',
        sender_id:       customerId,
        content:         content.trim(),
        attachments:     attachments ?? [],
      },
    }),
    prisma.supportConversation.update({
      where: { id: conversationId },
      data:  {
        last_message_at: new Date(),
        status: conv.status === 'RESOLVED' ? 'OPEN' : conv.status,
      },
    }),
  ]);

  emitNewMessage(conversationId, message);
  return message;
}

module.exports = { listMyConversations, createConversation, getMyConversation, sendMessage };
