const errorMiddleware = (err, req, res, next) => {
  // body-parser envoie un SyntaxError quand le body JSON est vide ou malformé
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Corps JSON invalide ou vide' });
  }

  console.error(err.stack || err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
