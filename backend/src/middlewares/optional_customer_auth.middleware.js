const jwt    = require('jsonwebtoken');
const { secret } = require('../config/jwt');
const prisma = require('../config/database');

const optionalCustomerAuthMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return next(); 
  }

  const token = header.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return next(); 
  }

  if (!decoded.id) return next();

  try {
    const customer = await prisma.customer.findFirst({
      where:  { user_id: decoded.id, is_deleted: false },
      select: { id: true, is_active: true },
    });
    // Client bloqué (WF #7) : traité comme un visiteur anonyme.
    if (customer && customer.is_active) {
      req.customerId = customer.id;
      req.userId     = decoded.id;
    }
  } catch {
  }

  next();
};

module.exports = optionalCustomerAuthMiddleware;