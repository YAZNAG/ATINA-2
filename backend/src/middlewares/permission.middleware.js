const response = require('../utils/response');

const permissionMiddleware = (permissionCode) => {
  return (req, res, next) => {
    if (!req.userPermissions || !req.userPermissions.includes(permissionCode)) {
      return response.error(res, `Permission denied: '${permissionCode}' required`, 403);
    }
    next();
  };
};

module.exports = permissionMiddleware;
