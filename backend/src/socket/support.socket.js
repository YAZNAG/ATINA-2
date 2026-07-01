/**
 * Support Socket.IO — temps réel pour le chat support.
 *
 * Path : /socket/support
 * Auth : customer JWT  { id: userId(Int), role: 'customer' }
 *        ou agent JWT  { userId: userId(Int) }
 *
 * Rooms : conversation:{conversation_id}
 *
 * Événements client → serveur :
 *  - join_conversation   { conversation_id }  → rejoindre la room (validé côté serveur)
 *
 * Événements serveur → client :
 *  - support:new_message      { conversation_id, message }
 *  - support:status_changed   { conversation_id, status }
 *  - support:agent_assigned   { conversation_id, agent }
 *  - error                    { message }
 */

const jwt    = require('jsonwebtoken');
const prisma = require('../config/database');
const { secret } = require('../config/jwt');

let _io = null;

// ── Setup ─────────────────────────────────────────────────────────────────────
function setupSupportSocket(httpServer) {
  const { Server } = require('socket.io');

  _io = new Server(httpServer, {
    cors:  { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket/support',
  });

  _io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
      if (!token) return next(new Error('Token requis'));

      let payload;
      try { payload = jwt.verify(token, secret); }
      catch { return next(new Error('Token invalide ou expiré')); }

      if (payload.role === 'customer') {
        // Customer token : id = User.id (Int)
        const customer = await prisma.customer.findFirst({
          where:  { user_id: payload.id, is_deleted: false },
          select: { id: true, name: true },
        });
        if (!customer) return next(new Error('Client introuvable'));

        socket.actorType  = 'customer';
        socket.actorId    = customer.id;   // UUID
        socket.actorName  = customer.name;
      } else if (payload.userId) {
        // Backoffice token : userId = User.id (Int)
        const user = await prisma.user.findFirst({
          where:  { id: payload.userId, is_active: true, is_deleted: false },
          select: { id: true, full_name: true },
        });
        if (!user) return next(new Error('Agent introuvable'));

        socket.actorType = 'agent';
        socket.actorId   = String(user.id);
        socket.actorName = user.full_name;
      } else {
        return next(new Error('Type de token non reconnu'));
      }

      next();
    } catch (err) {
      next(new Error('Erreur authentification socket'));
    }
  });

  _io.on('connection', (socket) => {
    console.log(`[support-socket] ${socket.actorType} "${socket.actorName}" connecté`);

    // Le client demande à rejoindre une conversation
    socket.on('join_conversation', async ({ conversation_id } = {}) => {
      if (!conversation_id) return socket.emit('error', { message: 'conversation_id requis' });

      try {
        const conv = await prisma.supportConversation.findUnique({
          where:  { id: conversation_id },
          select: { id: true, customer_id: true, assigned_agent_id: true },
        });
        if (!conv) return socket.emit('error', { message: 'Conversation introuvable' });

        // Vérification d'accès
        if (socket.actorType === 'customer' && conv.customer_id !== socket.actorId) {
          return socket.emit('error', { message: 'Accès refusé' });
        }

        socket.join(`conversation:${conversation_id}`);
        console.log(`[support-socket] ${socket.actorType} "${socket.actorName}" → room conversation:${conversation_id}`);
      } catch {
        socket.emit('error', { message: 'Erreur serveur' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[support-socket] ${socket.actorType} "${socket.actorName}" déconnecté (${reason})`);
    });

    socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));
  });

  console.log('[socket] Support Socket.IO prêt sur /socket/support');
  return _io;
}

// ── Émetteurs ─────────────────────────────────────────────────────────────────

function emitNewMessage(conversation_id, message) {
  if (!_io) return;
  _io.to(`conversation:${conversation_id}`).emit('support:new_message', { conversation_id, message });
}

function emitStatusChanged(conversation_id, status) {
  if (!_io) return;
  _io.to(`conversation:${conversation_id}`).emit('support:status_changed', { conversation_id, status });
}

function emitAgentAssigned(conversation_id, agent) {
  if (!_io) return;
  _io.to(`conversation:${conversation_id}`).emit('support:agent_assigned', { conversation_id, agent });
}

module.exports = { setupSupportSocket, emitNewMessage, emitStatusChanged, emitAgentAssigned };
