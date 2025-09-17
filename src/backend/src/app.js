const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import middleware
const {
  SecurityMiddleware,
  ErrorMiddleware,
  ValidationMiddleware
} = require('./middleware');

// Import routes
const routes = require('./routes');

class Application {
  constructor() {
    this.app = express();
    this.securityMiddleware = new SecurityMiddleware();
    this.errorMiddleware = new ErrorMiddleware();
    this.validationMiddleware = new ValidationMiddleware();

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    // Request ID generation
    this.app.use(this.errorMiddleware.requestId());

    // Security middleware
    this.app.use(this.securityMiddleware.helmet());
    this.app.use(this.securityMiddleware.cors());

    // Rate limiting
    this.app.use(this.securityMiddleware.rateLimit());
    this.app.use('/api/v1/auth', this.securityMiddleware.authRateLimit());
    this.app.use('/api/v1', this.securityMiddleware.apiRateLimit());

    // Request parsing and validation
    this.app.use(this.securityMiddleware.requestSizeLimit());
    this.app.use(this.securityMiddleware.validateContentType());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Logging
    const logFormat = process.env.NODE_ENV === 'production'
      ? 'combined'
      : 'dev';
    this.app.use(morgan(logFormat));

    // Input sanitization
    this.app.use(this.validationMiddleware.sanitize());
  }

  initializeRoutes() {
    // Mount all routes
    this.app.use('/', routes);

    // Handle 404 for undefined routes
    this.app.use(this.errorMiddleware.notFound());
  }

  initializeErrorHandling() {
    // Global error handler (must be last)
    this.app.use(this.errorMiddleware.errorHandler());
  }

  getApp() {
    return this.app;
  }

  start(port = process.env.PORT || 3000) {
    const server = this.app.listen(port, () => {
      console.log(`🚀 Hsinchu Pass Safety Guardian API Server running on port ${port}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${port}/api/v1`);
      console.log(`📋 Health Check: http://localhost:${port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

    return server;
  }
}

// Create application instance
const application = new Application();
const app = application.getApp();

// Export both the app and the application class
module.exports = app;
module.exports.Application = Application;