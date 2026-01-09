const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log request
  logger.request(req);

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.response(req, res, duration);
  });

  next();
}

module.exports = requestLogger;
