const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

class SecurityMiddleware {
  constructor() {
    this.allowedOrigins = [
      'https://app.hsinchu.gov.tw',
      'https://hsinchu.gov.tw',
      'https://admin.hsinchu.gov.tw'
    ];

    // Add development origins in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      this.allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      );
    }
  }

  // CORS configuration
  cors() {
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (this.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
      ]
    });
  }

  // Security headers using Helmet
  helmet() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://mydata.nat.gov.tw"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  // Rate limiting
  rateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: 'Rate Limit Exceeded',
        message: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
      }
    });
  }

  // Strict rate limiting for authentication endpoints
  authRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Limit auth requests to 10 per 15 minutes
      message: {
        success: false,
        error: 'Authentication Rate Limit Exceeded',
        message: 'Too many authentication attempts, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true
    });
  }

  // API-specific rate limiting
  apiRateLimit() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // Limit API requests to 30 per minute
      message: {
        success: false,
        error: 'API Rate Limit Exceeded',
        message: 'Too many API requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  // Request size limiting
  requestSizeLimit() {
    return (req, res, next) => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const contentLength = parseInt(req.headers['content-length'] || '0');

      if (contentLength > maxSize) {
        return res.status(413).json({
          success: false,
          error: 'Payload Too Large',
          message: 'Request payload exceeds maximum allowed size'
        });
      }

      next();
    };
  }

  // IP whitelist for admin functions (if needed)
  ipWhitelist(allowedIPs = []) {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;

      if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Access denied from this IP address'
        });
      }

      next();
    };
  }

  // Content type validation
  validateContentType(allowedTypes = ['application/json']) {
    return (req, res, next) => {
      if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
      }

      const contentType = req.headers['content-type'];

      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          success: false,
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json'
        });
      }

      next();
    };
  }
}

module.exports = { SecurityMiddleware };