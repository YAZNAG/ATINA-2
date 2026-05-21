/**
 * Picker Socket.IO — temps réel pour le workflow picking.
 *
 * Rooms : chaque picker rejoint `node:{node_id}` après authentification.
 *
 * Événements émis par le backend :
 *  - picker:new_order    → nouvelle commande confirmed dans ce node
 *  - picker:order_taken  → commande acceptée par un picker
 *  - picker:session_started → session démarrée
 */

const jwt    = require('jsonwebtoken');
const prisma = require('../config/database');
const { secret } = require('../config/jwt');

// Singleton — exposé à toute l'application via setupPickerSocket(httpServer)
let _io = null;

// ── Setup ─────────────────────────────────────────────────────────────────────
function setupPickerSocket(httpServer) {
  const { Server } = require('socket.io');

  _io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket/picker',
  });

  _io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
      if (!token) return next(new Error('Token picker requis'));

      let payload;
      try {
        payload = jwt.verify(token, secret);
      } catch {
        return next(new Error('Token invalide ou expiré'));
      }

      if (payload.profile_type !== 'picker')
        return next(new Error('Accès réservé aux pickers'));

      const picker = await prisma.picker.findFirst({
        where:  { id: payload.id, is_active: true, is_deleted: false },
        select: { id: true, name: true, node_id: true, phone_number: true },
      });
      if (!picker) return next(new Error('Picker introuvable ou inactif'));

      socket.pickerId = picker.id;
      socket.pickerName = picker.name;
      socket.nodeId = picker.node_id;
      next();
    } catch (err) {
      next(new Error('Erreur authentification socket'));
    }
  });

  _io.on('connection', (socket) => {
    const room = `node:${socket.nodeId}`;
    socket.join(room);

    console.log(`[socket] Picker "${socket.pickerName}" connecté → room "${room}"`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Picker "${socket.pickerName}" déconnecté (${reason})`);
    });

    // Ping/pong pour maintenir la connexion
    socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));
  });

  console.log('[socket] Picker Socket.IO prêt sur /socket/picker');
  return _io;
}

// ── Émetteurs (appelés par les services) ─────────────────────────────────────

/**
 * Nouvelle commande confirmed → notifie tous les pickers du node.
 */
function emitNewOrder(node_id, orderData) {
  if (!_io) return;
  _io.to(`node:${node_id}`).emit('picker:new_order', orderData);
  console.log(`[socket] picker:new_order → node:${node_id}`, orderData.reference ?? orderData.order_id?.slice(0, 8));
}

/**
 * Commande prise par un picker → notifie les autres.
 */
function emitOrderTaken(node_id, data) {
  if (!_io) return;
  _io.to(`node:${node_id}`).emit('picker:order_taken', data);
  console.log(`[socket] picker:order_taken → node:${node_id}`, data.order_id?.slice(0, 8));
}

/**
 * Session picking démarrée.
 */
function emitSessionStarted(node_id, data) {
  if (!_io) return;
  _io.to(`node:${node_id}`).emit('picker:session_started', data);
}

module.exports = { setupPickerSocket, emitNewOrder, emitOrderTaken, emitSessionStarted };
