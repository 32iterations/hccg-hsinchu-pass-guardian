const winston = require('winston');

class ErrorMiddleware {
  constructor() {
    this.logger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log' })
      ]
    });
  }

  // 404 handler for undefined routes
  notFound() {
    return (req, res, next) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: req.originalUrl
      });
    };
  }

  // Global error handler
  errorHandler() {
    return (error, req, res, next) => {
      // Generate unique request ID for tracking
      const requestId = req.requestId || this.generateRequestId();

      // Log error with context
      this.logger.error({
        error: error.message,
        stack: error.stack,
        requestId,
        path: req.originalUrl,
        method: req.method,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });

      // Default error response
      let statusCode = 500;
      let message = 'An unexpected error occurred';
      let errorType = 'Internal Server Error';

      // Handle specific error types
      if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        errorType = 'Validation Error';
      } else if (error.name === 'UnauthorizedError' || error.message.includes('Unauthorized')) {
        statusCode = 401;
        message = 'Authentication required';
        errorType = 'Unauthorized';
      } else if (error.name === 'ForbiddenError' || error.message.includes('Forbidden')) {
        statusCode = 403;
        message = 'Access forbidden';
        errorType = 'Forbidden';
      } else if (error.name === 'NotFoundError' || error.message.includes('not found')) {
        statusCode = 404;
        message = 'Resource not found';
        errorType = 'Not Found';
      } else if (error.name === 'ConflictError' || error.message.includes('already exists')) {
        statusCode = 409;
        message = 'Resource conflict';
        errorType = 'Conflict';
      } else if (error.name === 'TooManyRequestsError') {
        statusCode = 429;
        message = 'Too many requests, please try again later';
        errorType = 'Rate Limit Exceeded';
      }

      // Prepare error response
      const errorResponse = {
        success: false,
        error: errorType,
        message,
        requestId
      };

      // Include stack trace and additional details in development
      if (process.env.NODE_ENV !== 'production') {
        errorResponse.stack = error.stack;
        errorResponse.details = error.details || error.message;
      }

      // Add retry information for rate limiting
      if (statusCode === 429) {
        errorResponse.retryAfter = error.retryAfter || 60;
        res.set('Retry-After', errorResponse.retryAfter);
      }

      res.status(statusCode).json(errorResponse);
    };
  }

  // Request ID middleware
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  requestId() {
    return (req, res, next) => {
      req.requestId = this.generateRequestId();
      res.set('X-Request-ID', req.requestId);
      next();
    };
  }

  // Rate limiting error handler
  rateLimitHandler() {
    return (req, res, next) => {
      res.status(429).json({
        success: false,
        error: 'Rate Limit Exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: 60
      });
    };
  }
}

module.exports = { ErrorMiddleware };