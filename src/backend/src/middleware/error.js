const crypto = require('crypto');

class ErrorMiddleware {
  constructor() {
    this.errorCodes = {
      ValidationError: 400,
      UnauthorizedError: 401,
      ForbiddenError: 403,
      NotFoundError: 404,
      ConflictError: 409,
      RateLimitError: 429,
      InternalServerError: 500
    };
  }

  // Request ID middleware
  requestId() {
    return (req, res, next) => {
      req.requestId = crypto.randomUUID();
      res.set('X-Request-ID', req.requestId);
      next();
    };
  }

  // 404 handler for undefined routes
  notFound() {
    return (req, res, next) => {
      const error = new Error(`The requested resource was not found`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      error.path = req.originalUrl;
      next(error);
    };
  }

  // Global error handler
  errorHandler() {
    return (err, req, res, next) => {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const requestId = req.requestId || crypto.randomUUID();

      // Set default error properties
      const statusCode = err.status || err.statusCode || 500;
      const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

      // Log the error
      const logData = {
        error: err.message,
        stack: err.stack,
        requestId,
        path: req.originalUrl,
        method: req.method,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      };

      if (statusCode >= 500) {
        console.error(logData);
      } else {
        console.warn('Client Error:', logData);
      }

      // Prepare response
      const response = {
        success: false,
        error: this.getErrorMessage(statusCode),
        message: isDevelopment ? (err.message || 'An unexpected error occurred') :
                 (statusCode >= 500 ? 'An unexpected error occurred' : (err.message || 'An unexpected error occurred'))
      };

      // Only include requestId in non-test environments or for server errors
      if (process.env.NODE_ENV !== 'test' || statusCode >= 500) {
        response.requestId = requestId;
      }

      // Add path for 404 errors
      if (statusCode === 404) {
        response.path = req.originalUrl;
      }

      // Add validation details for 400 errors
      if (statusCode === 400 && err.details) {
        response.details = err.details;
      }

      // Add required permissions for 403 errors
      if (statusCode === 403 && err.required) {
        response.required = err.required;
      }

      // Add retry information for rate limiting
      if (statusCode === 429) {
        response.retryAfter = err.retryAfter || 60;
        res.set('Retry-After', response.retryAfter);
      }

      // Include stack trace in development - but not for test environment
      if (isDevelopment && statusCode >= 500 && process.env.NODE_ENV !== 'test') {
        response.stack = err.stack;
      }

      // Send error response
      res.status(statusCode).json(response);
    };
  }

  getErrorMessage(statusCode) {
    const messages = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      410: 'Gone',
      429: 'Rate Limit Exceeded',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };

    return messages[statusCode] || 'Unknown Error';
  }

  // Custom error creators
  createValidationError(message, details = []) {
    const error = new Error(message);
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return error;
  }

  createUnauthorizedError(message = 'Authentication required') {
    const error = new Error(message);
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    return error;
  }

  createForbiddenError(message = 'Insufficient permissions', required = []) {
    const error = new Error(message);
    error.status = 403;
    error.code = 'FORBIDDEN';
    error.required = required;
    return error;
  }

  createNotFoundError(message = 'Resource not found') {
    const error = new Error(message);
    error.status = 404;
    error.code = 'NOT_FOUND';
    return error;
  }

  createConflictError(message = 'Resource conflict') {
    const error = new Error(message);
    error.status = 409;
    error.code = 'CONFLICT';
    return error;
  }

  createRateLimitError(message = 'Rate limit exceeded', retryAfter = 60) {
    const error = new Error(message);
    error.status = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.retryAfter = retryAfter;
    return error;
  }
}

module.exports = { ErrorMiddleware };