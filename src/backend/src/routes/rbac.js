const express = require('express');
const { ValidationMiddleware, schemas } = require('../middleware');
const { authMiddleware } = require('../middleware/shared');
const RBACService = require('../../services/RBACService');

const router = express.Router();
const validationMiddleware = new ValidationMiddleware();
const rbacService = new RBACService({
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {}
  },
  database: null,
  auditService: null
});

// Apply authentication to all RBAC routes
router.use(authMiddleware.authenticate());

// GET /api/v1/rbac/roles - Get all available roles
router.get('/roles',
  authMiddleware.requirePermissions(['view_roles']),
  async (req, res, next) => {
    try {
      const roles = await rbacService.getAllRoles();

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/rbac/roles/assign - Assign roles to user
router.post('/roles/assign',
  authMiddleware.requirePermissions(['manage_roles']),
  validationMiddleware.validate(schemas.roleAssignment),
  async (req, res, next) => {
    try {
      const { userId, roles } = req.body;
      const assignedBy = req.user.userId;

      const result = await rbacService.assignRoles(userId, roles, assignedBy);

      res.json({
        success: true,
        message: 'Roles assigned successfully',
        data: {
          userId,
          assignedRoles: roles,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/rbac/roles/remove - Remove roles from user
router.delete('/roles/remove',
  authMiddleware.requirePermissions(['manage_roles']),
  validationMiddleware.validate(schemas.roleRemoval),
  async (req, res, next) => {
    try {
      const { userId, roles } = req.body;
      const removedBy = req.user.userId;

      // Check if user exists
      const userExists = await rbacService.userExists(userId);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const result = await rbacService.removeRoles(userId, roles, removedBy);

      res.json({
        success: true,
        message: 'Roles removed successfully',
        data: {
          userId,
          removedRoles: roles,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/rbac/permissions/validate - Validate user permissions
router.get('/permissions/validate',
  validationMiddleware.validate(schemas.permissionValidation, 'query'),
  async (req, res, next) => {
    try {
      const { action, resource, resourceId } = req.query;
      const userId = req.user.userId;

      const validation = await rbacService.validatePermissions(
        userId,
        [action],
        { action, resource, resourceId }
      );

      res.json({
        success: true,
        data: {
          hasPermission: validation.hasPermission,
          permissions: req.user.permissions,
          reason: validation.reason || 'Permission check completed'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/rbac/audit-trail - Get role assignment audit trail
router.get('/audit-trail',
  authMiddleware.requirePermissions(['view_audit_trail']),
  validationMiddleware.validate(schemas.pagination, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, startDate, endDate, userId } = req.query;

      const auditData = await rbacService.getAuditTrail({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        startDate,
        endDate,
        userId
      });

      res.json({
        success: true,
        data: {
          auditLog: auditData.records,
          pagination: {
            total: auditData.total,
            page: auditData.page,
            limit: auditData.limit,
            totalPages: Math.ceil(auditData.total / auditData.limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;