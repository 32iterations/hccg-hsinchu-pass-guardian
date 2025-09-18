const { AuthMiddleware } = require("./auth");
const { ValidationMiddleware } = require("./validation");
const { SecurityMiddleware } = require("./security");
const { ErrorMiddleware } = require("./error");

// Create shared instances
const authMiddleware = new AuthMiddleware();
const validationMiddleware = new ValidationMiddleware();
const securityMiddleware = new SecurityMiddleware();
const errorMiddleware = new ErrorMiddleware();

module.exports = {
  authMiddleware,
  validationMiddleware,
  securityMiddleware,
  errorMiddleware,
  AuthMiddleware,
  ValidationMiddleware,
  SecurityMiddleware,
  ErrorMiddleware
};
