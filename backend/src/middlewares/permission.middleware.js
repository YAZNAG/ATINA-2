const response = require('../utils/response');

const permissionMiddleware = (permissionCode) => {
  return (req, res, next) => {
    if (!req.userPermissions || !req.userPermissions.includes(permissionCode)) {
      return response.error(res, `Permission denied: '${permissionCode}' required`, 403);
    }
    next();
  };
};

/** Au moins une des permissions listées est requise. */
permissionMiddleware.permAny = (codes) => {
  return (req, res, next) => {
    const ok =
      req.userPermissions &&
      codes.some((c) => req.userPermissions.includes(c));
    if (!ok) {
      return response.error(res, `Permission denied: one of [${codes.join(', ')}] required`, 403);
    }
    next();
  };
};

module.exports = permissionMiddleware;
