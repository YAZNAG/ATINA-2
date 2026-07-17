const prisma = require('../../config/database');
const { emitNewMessage, emitStatusChanged, emitAgentAssigned } = require('../../socket/support.socket');

const VALID_STATUSES   = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const VALID_CATEGORIES = ['ORDER', 'ACCOUNT', 'LOYALTY', 'PRODUCT', 'OTHER'];

const CONV_INCLUDE = {
  customer:       { select: { id: true, name: true, phone_number: true } },
  order:          { select: { id: true, created_at: true } },
  assigned_agent: { select: { id: true, full_name: true, email: true } },
  _count:         { select: { messages: true } },
};

function formatConv(c) {
  return {
    id:             c.id,
    subject:        c.subject,
    category:       c.category,
    status:         c.status,
    last_message_at: c.last_message_at,
    created_at:     c.created_at,
    customer:       c.customer,
    order_id:       c.order_id,
    order:          c.order ?? null,
    assigned_agent: c.assigned_agent ?? null,
    messages_count: c._count?.messages ?? 0,
  };
}

// Liste de conversations

async function listConversations(query = {}) {
  const where = {};
  if (query.status)            where.status      = query.status;
  if (query.category)          where.category    = query.category;
  if (query.customer_id)       where.customer_id = query.customer_id;
  if (query.assigned_agent_id) where.assigned_agent_id = Number(query.assigned_agent_id);
  if (query.unassigned === 'true') where.assigned_agent_id = null;

  const conversations = await prisma.supportConversation.findMany({
    where,
    include:  CONV_INCLUDE,
    orderBy:  { last_message_at: 'desc' },
  });

  return conversations.map(formatConv);
}

// Conversation

async function getConversation(id) {
  const conv = await prisma.supportConversation.findUnique({
    where:   { id },
    include: {
      ...CONV_INCLUDE,
      messages: { orderBy: { created_at: 'asc' } },
    },
  });
  if (!conv) throw { statusCode: 404, message: 'Conversation introuvable' };
  return { ...formatConv(conv), messages: conv.messages };
}

// Assigner un agent 
async function assignAgent(id, agent_id) {
  const conv = await prisma.supportConversation.findUnique({ where: { id } });
  if (!conv) throw { statusCode: 404, message: 'Conversation introuvable' };

  const agent = await prisma.user.findFirst({
    where:  { id: Number(agent_id), is_active: true, is_deleted: false },
    select: { id: true, full_name: true, email: true },
  });
  if (!agent) throw { statusCode: 404, message: 'Agent introuvable' };

  await prisma.supportConversation.update({
    where: { id },
    data:  { assigned_agent_id: agent.id },
  });

  emitAgentAssigned(id, agent);
  return { assigned_agent: agent };
}

// Changer le statut 
async function changeStatus(id, status) {
  if (!VALID_STATUSES.includes(status))
    throw { statusCode: 400, message: `Statut invalide. Valeurs: ${VALID_STATUSES.join(', ')}` };

  const conv = await prisma.supportConversation.findUnique({ where: { id } });
  if (!conv) throw { statusCode: 404, message: 'Conversation introuvable' };

  await prisma.supportConversation.update({ where: { id }, data: { status } });

  emitStatusChanged(id, status);
  return { status };
}

// Envoyer un message (AGENT ou BOT) 
async function sendMessage(conversation_id, { sender_type, sender_id, content, attachments = [] }) {
  if (!['AGENT', 'BOT'].includes(sender_type))
    throw { statusCode: 400, message: 'sender_type doit être AGENT ou BOT' };
  if (!content?.trim()) throw { statusCode: 400, message: 'Contenu requis' };

  const conv = await prisma.supportConversation.findUnique({ where: { id: conversation_id } });
  if (!conv) throw { statusCode: 404, message: 'Conversation introuvable' };

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        conversation_id,
        sender_type,
        sender_id: sender_id ? String(sender_id) : null,
        content:     content.trim(),
        attachments: attachments ?? [],
      },
    }),
    prisma.supportConversation.update({
      where: { id: conversation_id },
      data:  { last_message_at: new Date(), status: conv.status === 'CLOSED' ? 'OPEN' : conv.status },
    }),
  ]);

  emitNewMessage(conversation_id, message);
  return message;
}

module.exports = { listConversations, getConversation, assignAgent, changeStatus, sendMessage };
