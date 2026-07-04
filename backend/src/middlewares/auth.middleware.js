const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const response = require('../utils/response');
const prisma = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    // Extra safety: normalize possible header casing.
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !String(authHeader).toLowerCase().startsWith('bearer ')) {
      // If header exists but does not look like Bearer, still treat as missing.
      return response.error(res, 'Access token required', 400);
    }

    const token = String(authHeader).split(' ')[1];
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Validate that the token has a userId
    if (!decoded.userId) {
      return response.error(res, 'Invalid token: missing userId', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        user_roles: {
          include: {
            role: {
              include: {
                role_permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      return response.error(res, 'User not found or inactive', 401);
    }

    const permissions = new Set();
    user.user_roles.forEach((ur) => {
      ur.role.role_permissions.forEach((rp) => {
        permissions.add(rp.permission.code);
      });
    });

    req.user = user;
    req.userPermissions = [...permissions];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return response.error(res, 'Token expired', 401);
    }
    return response.error(res, 'Invalid token', 401);
  }
};

module.exports = authMiddleware;
