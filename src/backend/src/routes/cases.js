const express = require('express');
const { AuthMiddleware, ValidationMiddleware, schemas } = require('../middleware');
const CaseFlowService = require('../../services/CaseFlowService');

const router = express.Router();
const authMiddleware = new AuthMiddleware();
const validationMiddleware = new ValidationMiddleware();
const caseFlowService = new CaseFlowService({
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {}
  },
  database: null,
  auditService: null,
  geoAlertService: null,
  rbacService: null
});

// Apply authentication to all case routes
router.use(authMiddleware.authenticate());

// POST /api/v1/cases/create - Create new case
router.post('/create',
  authMiddleware.requirePermissions(['create_cases']),
  validationMiddleware.validate(schemas.createCase),
  validationMiddleware.sanitize(),
  async (req, res, next) => {
    try {
      const caseData = {
        ...req.body,
        createdBy: req.user.userId,
        status: 'active'
      };

      const newCase = await caseFlowService.createCase(caseData);

      res.status(201).json({
        success: true,
        message: 'Case created successfully',
        data: {
          id: newCase.id,
          ...caseData,
          createdAt: newCase.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/cases/:id - Get case details
router.get('/:id',
  authMiddleware.requirePermissions(['read_cases']),
  authMiddleware.requireResourceAccess('case'),
  async (req, res, next) => {
    try {
      const caseId = req.params.id;
      const caseData = await caseFlowService.getCaseById(caseId);

      if (!caseData) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Case not found'
        });
      }

      res.json({
        success: true,
        data: caseData
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/cases/:id/status - Update case status
router.put('/:id/status',
  authMiddleware.requirePermissions(['update_case_status']),
  validationMiddleware.validate(schemas.updateCaseStatus),
  async (req, res, next) => {
    try {
      const caseId = req.params.id;
      const { status, resolution, resolvedBy, resolvedAt } = req.body;
      const updatedBy = req.user.userId;

      // Get current case to check previous status
      const currentCase = await caseFlowService.getCaseById(caseId);
      if (!currentCase) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Case not found'
        });
      }

      // Validate status transition
      const validTransitions = {
        'active': ['in_progress', 'resolved', 'cancelled'],
        'in_progress': ['resolved', 'cancelled', 'active'],
        'resolved': [],
        'cancelled': []
      };

      if (!validTransitions[currentCase.status]?.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `Invalid status transition from ${currentCase.status} to ${status}`
        });
      }

      const updatedCase = await caseFlowService.updateCaseStatusAPI(
        caseId,
        { status, resolution, resolvedBy, resolvedAt },
        updatedBy
      );

      res.json({
        success: true,
        message: 'Case status updated successfully',
        data: {
          id: caseId,
          previousStatus: currentCase.status,
          newStatus: status,
          updatedAt: new Date().toISOString(),
          updatedBy
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/cases/search - Search cases
router.get('/search',
  authMiddleware.requirePermissions(['search_cases']),
  validationMiddleware.validate(schemas.searchCases, 'query'),
  async (req, res, next) => {
    try {
      const searchParams = {
        ...req.query,
        userId: req.user.userId,
        userRoles: req.user.roles
      };

      const results = await caseFlowService.searchCases(searchParams);

      res.json({
        success: true,
        data: {
          cases: results.cases,
          pagination: {
            total: results.total,
            page: results.page,
            limit: results.limit,
            totalPages: Math.ceil(results.total / results.limit)
          },
          filters: req.query
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/cases/:id/assign - Assign case to volunteer
router.post('/:id/assign',
  authMiddleware.requirePermissions(['assign_cases']),
  validationMiddleware.validate(schemas.assignCase),
  async (req, res, next) => {
    try {
      const caseId = req.params.id;
      const { assigneeId, assigneeType, notes } = req.body;
      const assignedBy = req.user.userId;

      // Check if case exists
      const caseData = await caseFlowService.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Case not found'
        });
      }

      // Check if assignee exists and is eligible
      const assigneeExists = await caseFlowService.validateAssignee(assigneeId, assigneeType);
      if (!assigneeExists) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `${assigneeType} not found or not eligible`
        });
      }

      // Check volunteer availability
      const isAvailable = await caseFlowService.checkAssigneeAvailability(assigneeId);
      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: `${assigneeType} is currently unavailable`
        });
      }

      const assignment = await caseFlowService.assignCase(
        caseId,
        { assigneeId, assigneeType, notes },
        assignedBy
      );

      res.json({
        success: true,
        message: 'Case assigned successfully',
        data: {
          caseId,
          assignedTo: assigneeId,
          assignedBy,
          assignedAt: new Date().toISOString(),
          previousAssignee: caseData.assignedTo || null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;