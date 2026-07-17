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
      select: { id: true },
    });
    if (customer) {
      req.customerId = customer.id;
      req.userId     = decoded.id;
    }
  } catch {
  }

  next();
};

module.exports = optionalCustomerAuthMiddleware;