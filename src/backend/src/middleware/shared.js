// Shared middleware instances to ensure test tokens are available across routes
const { AuthMiddleware } = require('./auth');
const { ValidationMiddleware } = require('./validation');
const { ErrorMiddleware } = require('./error');
const { SecurityMiddleware } = require('./security');

// Create shared instances
const authMiddleware = new AuthMiddleware();
const validationMiddleware = new ValidationMiddleware();
const errorMiddleware = new ErrorMiddleware();
const securityMiddleware = new SecurityMiddleware();

module.exports = {
  authMiddleware,
  validationMiddleware,
  errorMiddleware,
  securityMiddleware
};