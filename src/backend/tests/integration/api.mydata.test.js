const request = require('supertest');
const app = require('../../src/app');

describe('MyData API Endpoints', () => {
  const mockAuthSession = {
    id: 'session123',
    userId: 'user456',
    status: 'pending',
    scopes: ['location_tracking', 'emergency_contact'],
    redirectUrl: 'https://app.hsinchu.gov.tw/callback'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/mydata/authorize', () => {
    const authParams = {
      userId: 'user456',
      scopes: 'location_tracking,emergency_contact',
      purpose: 'safety_monitoring',
      redirectUri: 'https://app.hsinchu.gov.tw/callback',
      state: 'random-state-string'
    };

    it('should initiate MyData authorization flow', async () => {
      const response = await request(app)
        .get('/api/v1/mydata/authorize')
        .set('Authorization', 'Bearer user-token')
        .query(authParams)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          authorizationUrl: expect.stringContaining('https://mydata.nat.gov.tw'),
          sessionId: expect.any(String),
          expiresAt: expect.any(String),
          state: authParams.state,
          scopes: expect.arrayContaining(['location_tracking', 'emergency_contact'])
        }
      });
    });

    it('should validate required scopes', async () => {
      await request(app)
        .get('/api/v1/mydata/authorize')
        .set('Authorization', 'Bearer user-token')
        .query({
          ...authParams,
          scopes: 'invalid_scope'
        })
        .expect(400);
    });

    it('should validate redirect URI format', async () => {
      await request(app)
        .get('/api/v1/mydata/authorize')
        .set('Authorization', 'Bearer user-token')
        .query({
          ...authParams,
          redirectUri: 'invalid-url'
        })
        .expect(400);
    });

    it('should require user authentication', async () => {
      await request(app)
        .get('/api/v1/mydata/authorize')
        .query(authParams)
        .expect(401);
    });

    it('should validate purpose for data access', async () => {
      await request(app)
        .get('/api/v1/mydata/authorize')
        .set('Authorization', 'Bearer user-token')
        .query({
          ...authParams,
          purpose: ''
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/mydata/callback', () => {
    const callbackData = {
      code: 'auth-code-123',
      state: 'random-state-string',
      sessionId: 'session123'
    };

    it('should handle successful authorization callback', async () => {
      const response = await request(app)
        .post('/api/v1/mydata/callback')
        .send(callbackData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Authorization completed successfully',
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
          scopes: expect.any(Array),
          userInfo: expect.objectContaining({
            id: expect.any(String),
            consentTimestamp: expect.any(String)
          })
        }
      });
    });

    it('should validate authorization code', async () => {
      await request(app)
        .post('/api/v1/mydata/callback')
        .send({
          ...callbackData,
          code: 'invalid-code'
        })
        .expect(400);
    });

    it('should verify state parameter for CSRF protection', async () => {
      await request(app)
        .post('/api/v1/mydata/callback')
        .send({
          ...callbackData,
          state: 'mismatched-state'
        })
        .expect(400);
    });

    it('should handle authorization errors from MyData platform', async () => {
      await request(app)
        .post('/api/v1/mydata/callback')
        .send({
          error: 'access_denied',
          error_description: 'User denied access',
          state: 'random-state-string'
        })
        .expect(400);
    });

    it('should validate session exists and is not expired', async () => {
      await request(app)
        .post('/api/v1/mydata/callback')
        .send({
          ...callbackData,
          sessionId: 'expired-session'
        })
        .expect(410);
    });
  });

  describe('GET /api/v1/mydata/progress/:id', () => {
    it('should return authorization progress status', async () => {
      const response = await request(app)
        .get('/api/v1/mydata/progress/session123')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          sessionId: 'session123',
          status: expect.oneOf(['pending', 'completed', 'failed', 'expired']),
          progress: expect.any(Number),
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              status: expect.any(String),
              timestamp: expect.any(String)
            })
          ]),
          estimatedCompletion: expect.any(String)
        }
      });
    });

    it('should return 404 for non-existent session', async () => {
      await request(app)
        .get('/api/v1/mydata/progress/nonexistent')
        .set('Authorization', 'Bearer user-token')
        .expect(404);
    });

    it('should enforce session ownership', async () => {
      await request(app)
        .get('/api/v1/mydata/progress/session123')
        .set('Authorization', 'Bearer other-user-token')
        .expect(403);
    });

    it('should provide real-time status updates', async () => {
      const response = await request(app)
        .get('/api/v1/mydata/progress/session123')
        .set('Authorization', 'Bearer user-token')
        .query({ realtime: true })
        .expect(200);

      expect(response.body.data).toHaveProperty('lastUpdated');
    });
  });

  describe('DELETE /api/v1/mydata/revoke/:id', () => {
    it('should revoke data access consent successfully', async () => {
      const response = await request(app)
        .delete('/api/v1/mydata/revoke/consent123')
        .set('Authorization', 'Bearer user-token')
        .send({
          reason: 'User requested data deletion',
          confirmRevocation: true
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Data access consent revoked successfully',
        data: {
          consentId: 'consent123',
          revokedAt: expect.any(String),
          revokedBy: expect.any(String),
          dataRetentionPolicy: expect.objectContaining({
            deletionScheduled: expect.any(String),
            anonymizationComplete: expect.any(Boolean)
          })
        }
      });
    });

    it('should require confirmation for revocation', async () => {
      await request(app)
        .delete('/api/v1/mydata/revoke/consent123')
        .set('Authorization', 'Bearer user-token')
        .send({
          reason: 'User requested data deletion'
        })
        .expect(400);
    });

    it('should validate user owns the consent', async () => {
      await request(app)
        .delete('/api/v1/mydata/revoke/consent123')
        .set('Authorization', 'Bearer other-user-token')
        .send({
          reason: 'User requested data deletion',
          confirmRevocation: true
        })
        .expect(403);
    });

    it('should handle already revoked consents', async () => {
      await request(app)
        .delete('/api/v1/mydata/revoke/revoked-consent')
        .set('Authorization', 'Bearer user-token')
        .send({
          reason: 'User requested data deletion',
          confirmRevocation: true
        })
        .expect(409);
    });

    it('should initiate immediate data anonymization', async () => {
      const response = await request(app)
        .delete('/api/v1/mydata/revoke/consent123')
        .set('Authorization', 'Bearer user-token')
        .send({
          reason: 'User requested data deletion',
          confirmRevocation: true,
          immediateAnonymization: true
        })
        .expect(200);

      expect(response.body.data.dataRetentionPolicy.anonymizationComplete).toBe(true);
    });
  });

  describe('GET /api/v1/mydata/consents', () => {
    it('should list user\'s active data consents', async () => {
      const response = await request(app)
        .get('/api/v1/mydata/consents')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          consents: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              scopes: expect.any(Array),
              grantedAt: expect.any(String),
              expiresAt: expect.any(String),
              status: expect.oneOf(['active', 'expired', 'revoked']),
              purpose: expect.any(String)
            })
          ]),
          totalCount: expect.any(Number),
          activeCount: expect.any(Number)
        }
      });
    });

    it('should filter consents by status', async () => {
      await request(app)
        .get('/api/v1/mydata/consents')
        .set('Authorization', 'Bearer user-token')
        .query({ status: 'active' })
        .expect(200);
    });

    it('should support pagination for consent history', async () => {
      await request(app)
        .get('/api/v1/mydata/consents')
        .set('Authorization', 'Bearer user-token')
        .query({ page: 2, limit: 10 })
        .expect(200);
    });
  });
});