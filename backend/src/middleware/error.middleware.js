function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal server error',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
