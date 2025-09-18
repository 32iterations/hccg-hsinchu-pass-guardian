const express = require('express');
const { ValidationMiddleware, schemas } = require('../middleware');
const { authMiddleware } = require('../middleware/shared');
const { getServices } = require('../services');

const router = express.Router();
const validationMiddleware = new ValidationMiddleware();
// Get services from dependency injection container
const services = getServices();
const rbacService = services.rbacService;

// Apply authentication to all RBAC routes
router.use(authMiddleware.authenticate());

// GET /api/v1/rbac/roles - Get all available roles
router.get('/roles',
  async (req, res, next) => {
    try {
      // Check if user has permission to view roles
      if (!req.user.permissions.includes('*') && !req.user.permissions.includes('view_roles')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      const roles = await rbacService.getAllRoles();

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('RBAC roles error:', error);
      next(error);
    }
  }
);

// POST /api/v1/rbac/roles/assign - Assign roles to user
router.post('/roles/assign',
  async (req, res, next) => {
    try {
      const { userId, roles } = req.body;
      const assignedBy = req.user.userId;

      // Check admin permissions
      if (!req.user.permissions.includes('*') && !req.user.permissions.includes('manage_roles')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Admin permissions required'
        });
      }

      // Validate required fields
      if (!userId || !roles || !Array.isArray(roles)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'userId and roles array are required'
        });
      }

      const result = await rbacService.assignRoles(userId, roles, assignedBy);

      res.json({
        success: true,
        message: 'Roles assigned successfully',
        data: result
      });
    } catch (error) {
      if (error.message.includes('Invalid roles')) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }
);

// DELETE /api/v1/rbac/roles/remove - Remove roles from user
router.delete('/roles/remove',
  async (req, res, next) => {
    try {
      const { userId, roles } = req.body;
      const removedBy = req.user.userId;

      // Check admin permissions
      if (!req.user.permissions.includes('*') && !req.user.permissions.includes('manage_roles')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Admin permissions required'
        });
      }

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
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/rbac/permissions/validate - Validate user permissions
router.get('/permissions/validate',
  async (req, res, next) => {
    try {
      const { action, resource, resourceId } = req.query;
      const userId = req.user.userId;

      // Validate required parameter
      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'action parameter is required'
        });
      }

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
  async (req, res, next) => {
    try {
      // Check admin permissions for audit trail access
      if (!req.user.permissions.includes('*') && !req.user.permissions.includes('view_audit_trail')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Insufficient permissions for this operation',
          required: ['view_audit_trail']
        });
      }

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

// POST /api/v1/rbac/field-access - Check field-level access
router.post('/field-access',
  async (req, res, next) => {
    try {
      const { userId, resourceId, fieldPath } = req.body;
      const requestingUserId = req.user.userId;

      // Allow users to check their own field access
      const targetUserId = userId || requestingUserId;

      const accessResult = await rbacService.checkFieldAccess({
        userId: targetUserId,
        resourceId,
        fieldPath
      });

      res.json({
        success: true,
        data: accessResult
      });
    } catch (error) {
      console.error('Field access check error:', error);
      next(error);
    }
  }
);

module.exports = router;