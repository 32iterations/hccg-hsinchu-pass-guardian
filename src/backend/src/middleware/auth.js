const jwt = require('jsonwebtoken');
const RBACService = require('../../services/RBACService');

class AuthMiddleware {
  constructor() {
    // Initialize RBAC service with mock dependencies for now
    this.rbacService = new RBACService({
      storage: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {}
      },
      database: null,
      auditService: null
    });
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
  }

  // JWT Authentication middleware
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authorization header is required'
          });
        }

        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, this.jwtSecret);

          // Check if token is expired
          if (decoded.exp && decoded.exp < Date.now() / 1000) {
            return res.status(401).json({
              success: false,
              error: 'Unauthorized',
              message: 'Token has expired'
            });
          }

          // Attach user info to request
          req.user = {
            userId: decoded.userId || decoded.id,
            roles: decoded.roles || [],
            permissions: decoded.permissions || []
          };

          next();
        } catch (jwtError) {
          if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({
              success: false,
              error: 'Unauthorized',
              message: 'Token has expired'
            });
          }

          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token'
          });
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Authentication error'
        });
      }
    };
  }

  // RBAC Permission middleware
  requirePermissions(requiredPermissions = []) {
    return async (req, res, next) => {
      try {
        const user = req.user;

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required'
          });
        }

        // Check if user has required permissions
        const hasPermission = await this.rbacService.validatePermissions(
          user.userId,
          requiredPermissions,
          {
            action: req.method.toLowerCase(),
            resource: req.baseUrl,
            resourceId: req.params.id
          }
        );

        if (!hasPermission.hasPermission) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Insufficient permissions for this operation',
            required: requiredPermissions
          });
        }

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Permission check error'
        });
      }
    };
  }

  // Resource-specific access control
  requireResourceAccess(resourceType) {
    return async (req, res, next) => {
      try {
        const user = req.user;
        const resourceId = req.params.id;

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Authentication required'
          });
        }

        // Check resource-specific access
        const hasAccess = await this.rbacService.checkResourceAccess(
          user.userId,
          resourceType,
          resourceId
        );

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `Insufficient permissions for ${resourceType} access`
          });
        }

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Resource access check error'
        });
      }
    };
  }
}

module.exports = { AuthMiddleware };