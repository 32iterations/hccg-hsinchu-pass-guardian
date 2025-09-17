const Joi = require('joi');

class ValidationMiddleware {
  // Generic validation middleware
  validate(schema, target = 'body') {
    return (req, res, next) => {
      const data = target === 'query' ? req.query : req.body;

      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const details = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Request validation failed',
          details
        });
      }

      // Replace original data with validated/sanitized data
      if (target === 'query') {
        req.query = value;
      } else {
        req.body = value;
      }

      next();
    };
  }

  // Input sanitization middleware
  sanitize() {
    return (req, res, next) => {
      // Recursive function to sanitize strings
      const sanitizeValue = (value) => {
        if (typeof value === 'string') {
          return value
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocols
            .replace(/on\w+\s*=/gi, ''); // Remove event handlers
        }
        if (typeof value === 'object' && value !== null) {
          const sanitized = {};
          for (const [key, val] of Object.entries(value)) {
            sanitized[key] = sanitizeValue(val);
          }
          return sanitized;
        }
        return value;
      };

      if (req.body) {
        req.body = sanitizeValue(req.body);
      }

      if (req.query) {
        req.query = sanitizeValue(req.query);
      }

      next();
    };
  }
}

// Common validation schemas
const schemas = {
  // RBAC schemas
  roleAssignment: Joi.object({
    userId: Joi.string().required(),
    roles: Joi.array().items(Joi.string()).min(1).required()
  }),

  roleRemoval: Joi.object({
    userId: Joi.string().required(),
    roles: Joi.array().items(Joi.string()).min(1).required()
  }),

  permissionValidation: Joi.object({
    action: Joi.string().required(),
    resource: Joi.string(),
    resourceId: Joi.string()
  }),

  // Case schemas
  createCase: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().min(1).max(2000).required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    location: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
      address: Joi.string().max(500)
    }).required(),
    contactInfo: Joi.object({
      name: Joi.string().max(100).required(),
      phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).required(),
      relationship: Joi.string().max(50)
    }).required(),
    missingPerson: Joi.object({
      name: Joi.string().max(100).required(),
      age: Joi.number().integer().min(0).max(150).required(),
      description: Joi.string().max(1000).required(),
      lastSeen: Joi.string().isoDate().required()
    }).required()
  }),

  updateCaseStatus: Joi.object({
    status: Joi.string().valid('active', 'in_progress', 'resolved', 'cancelled').required(),
    resolution: Joi.string().max(1000),
    resolvedBy: Joi.string(),
    resolvedAt: Joi.string().isoDate()
  }),

  assignCase: Joi.object({
    assigneeId: Joi.string().required(),
    assigneeType: Joi.string().valid('volunteer', 'case_worker', 'emergency_responder').default('volunteer'),
    notes: Joi.string().max(500)
  }),

  // Search schemas
  searchCases: Joi.object({
    status: Joi.string().valid('active', 'in_progress', 'resolved', 'cancelled'),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
    location: Joi.string(),
    radius: Joi.number().integer().min(0).max(50000).default(5000),
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  // MyData schemas
  mydataAuthorize: Joi.object({
    userId: Joi.string().required(),
    scopes: Joi.string().required().custom((value, helpers) => {
      const validScopes = ['location_tracking', 'emergency_contact', 'health_info', 'movement_patterns'];
      const requestedScopes = value.split(',').map(s => s.trim());

      for (const scope of requestedScopes) {
        if (!validScopes.includes(scope)) {
          return helpers.error('any.invalid', { value: scope });
        }
      }
      return requestedScopes;
    }),
    purpose: Joi.string().min(10).max(200).required(),
    redirectUri: Joi.string().uri().required(),
    state: Joi.string().required()
  }),

  mydataCallback: Joi.object({
    code: Joi.string(),
    state: Joi.string().required(),
    sessionId: Joi.string().required(),
    error: Joi.string(),
    error_description: Joi.string()
  }),

  mydataRevoke: Joi.object({
    reason: Joi.string().min(5).max(200).required(),
    confirmRevocation: Joi.boolean().valid(true).required(),
    immediateAnonymization: Joi.boolean().default(false)
  }),

  // Pagination schema
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

module.exports = { ValidationMiddleware, schemas };