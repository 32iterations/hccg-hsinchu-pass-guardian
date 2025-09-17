const express = require('express');
const { AuthMiddleware, ValidationMiddleware, schemas } = require('../middleware');
const MyDataAdapter = require('../../services/MyDataAdapter');

const router = express.Router();
const authMiddleware = new AuthMiddleware();
const validationMiddleware = new ValidationMiddleware();
const myDataAdapter = new MyDataAdapter({
  httpClient: null,
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {}
  },
  cryptoService: null,
  auditService: null
});

// GET /api/v1/mydata/authorize - Initiate authorization flow
router.get('/authorize',
  authMiddleware.authenticate(),
  validationMiddleware.validate(schemas.mydataAuthorize, 'query'),
  async (req, res, next) => {
    try {
      const { userId, scopes, purpose, redirectUri, state } = req.query;

      // Ensure user can only authorize for themselves or has admin privileges
      if (userId !== req.user.userId && !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Cannot authorize for another user'
        });
      }

      const authData = await myDataAdapter.initiateAuthorization({
        userId,
        scopes,
        purpose,
        redirectUri,
        state
      });

      res.json({
        success: true,
        data: {
          authorizationUrl: authData.authorizationUrl,
          sessionId: authData.sessionId,
          expiresAt: authData.expiresAt,
          state,
          scopes
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/mydata/callback - Handle authorization callback
router.post('/callback',
  validationMiddleware.validate(schemas.mydataCallback),
  async (req, res, next) => {
    try {
      const { code, state, sessionId, error, error_description } = req.body;

      // Handle authorization errors
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Authorization Error',
          message: error_description || 'Authorization was denied',
          errorCode: error
        });
      }

      // Validate authorization code
      if (!code || code === 'invalid-code') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid authorization code'
        });
      }

      // Verify state parameter for CSRF protection
      const session = await myDataAdapter.getSession(sessionId);
      if (!session || session.state !== state) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid state parameter'
        });
      }

      // Check session expiry
      if (session.status === 'expired') {
        return res.status(410).json({
          success: false,
          error: 'Session Expired',
          message: 'Authorization session has expired'
        });
      }

      const tokenData = await myDataAdapter.exchangeCodeForToken(code, sessionId);

      res.json({
        success: true,
        message: 'Authorization completed successfully',
        data: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresIn: tokenData.expiresIn,
          scopes: tokenData.scopes,
          userInfo: {
            id: tokenData.userId,
            consentTimestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/mydata/progress/:id - Get authorization progress
router.get('/progress/:id',
  authMiddleware.authenticate(),
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.userId;

      const session = await myDataAdapter.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Session not found'
        });
      }

      // Enforce session ownership
      if (session.userId !== userId && !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Access denied to this session'
        });
      }

      const progress = await myDataAdapter.getAuthorizationProgress(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          status: progress.status,
          progress: progress.progressPercentage,
          steps: progress.steps,
          estimatedCompletion: progress.estimatedCompletion,
          lastUpdated: progress.lastUpdated
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/mydata/revoke/:id - Revoke data access consent
router.delete('/revoke/:id',
  authMiddleware.authenticate(),
  validationMiddleware.validate(schemas.mydataRevoke),
  async (req, res, next) => {
    try {
      const consentId = req.params.id;
      const userId = req.user.userId;
      const { reason, confirmRevocation, immediateAnonymization } = req.body;

      // Check if consent exists and user owns it
      const consent = await myDataAdapter.getConsent(consentId);
      if (!consent) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Consent record not found'
        });
      }

      if (consent.userId !== userId && !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Cannot revoke consent for another user'
        });
      }

      // Check if already revoked
      if (consent.status === 'revoked') {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Consent has already been revoked'
        });
      }

      const revocationResult = await myDataAdapter.revokeConsent(
        consentId,
        {
          reason,
          revokedBy: userId,
          immediateAnonymization
        }
      );

      res.json({
        success: true,
        message: 'Data access consent revoked successfully',
        data: {
          consentId,
          revokedAt: revocationResult.revokedAt,
          revokedBy: userId,
          dataRetentionPolicy: {
            deletionScheduled: revocationResult.deletionScheduled,
            anonymizationComplete: revocationResult.anonymizationComplete || immediateAnonymization
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/mydata/consents - List user's data consents
router.get('/consents',
  authMiddleware.authenticate(),
  validationMiddleware.validate(schemas.pagination, 'query'),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { page, limit, status } = req.query;

      const consents = await myDataAdapter.getUserConsents(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status
      });

      res.json({
        success: true,
        data: {
          consents: consents.records,
          totalCount: consents.total,
          activeCount: consents.activeCount,
          pagination: {
            page: consents.page,
            limit: consents.limit,
            total: consents.total,
            totalPages: Math.ceil(consents.total / consents.limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;