const logger = require('../utils/logger');
const responseFormatter = require('../utils/responseFormatter');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  logger.error(`Error in ${req.method} ${req.path}:`, err.message);
  logger.debug(err.stack);

  // Determine status code
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  // Send error response
  res.status(statusCode).json(
    responseFormatter.error(message, err.details, errorCode)
  );
}

module.exports = errorHandler;
