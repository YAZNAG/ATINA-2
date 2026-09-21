const jwt    = require('jsonwebtoken');
const { secret } = require('../config/jwt');
const prisma = require('../config/database');
const resp   = require('../utils/response');

// Middleware for customer-facing authenticated routes.
// Reads Bearer token signed with { id: userId, role: 'customer' }
// and resolves the linked customer row, setting req.customerId + req.userId.
const customerAuthMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer '))
    return resp.error(res, 'Token requis', 401);

  const token = header.split(' ')[1];
  let decoded;
  try { decoded = jwt.verify(token, secret); }
  catch { return resp.error(res, 'Token invalide ou expiré', 401); }

  // Validate that the token has an id
  if (!decoded.id) {
    return resp.error(res, 'Token invalide: userId manquant', 401);
  }

  const customer = await prisma.customer.findFirst({
    where:  { user_id: decoded.id, is_deleted: false },
    select: { id: true, user_id: true, is_active: true },
  });

  if (!customer) return resp.error(res, 'Compte client introuvable', 401);
  // WF #7 : un client bloqué perd l'accès immédiatement, même avec une session ouverte.
  if (!customer.is_active) return resp.error(res, 'Votre compte est suspendu. Contactez le support Atina.', 403);

  req.customerId = customer.id;
  req.userId     = decoded.id;
  next();
};

module.exports = customerAuthMiddleware;
