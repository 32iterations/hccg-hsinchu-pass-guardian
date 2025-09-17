const request = require('supertest');
const app = require('../../src/app');

describe('API Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization header is required'
      });
    });

    it('should reject requests with invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    });

    it('should reject requests with expired JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Token has expired'
      });
    });

    it('should accept requests with valid JWT token', async () => {
      // This should not return 401, but may return other status codes based on permissions
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).not.toBe(401);
    });

    it('should extract user information from JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/test/user-info')
        .set('Authorization', 'Bearer valid-user-token')
        .expect(200);

      expect(response.body.data).toEqual(
        expect.objectContaining({
          userId: expect.any(String),
          roles: expect.any(Array),
          permissions: expect.any(Array)
        })
      );
    });
  });

  describe('RBAC Permission Middleware', () => {
    it('should allow access with sufficient permissions', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).not.toBe(403);
    });

    it('should deny access without sufficient permissions', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/audit-trail')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions for this operation',
        required: expect.any(Array)
      });
    });

    it('should check resource-specific permissions', async () => {
      const response = await request(app)
        .get('/api/v1/cases/other-user-case')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body.message).toContain('case access');
    });

    it('should handle role hierarchy correctly', async () => {
      const response = await request(app)
        .get('/api/v1/cases/search')
        .set('Authorization', 'Bearer case-manager-token');

      expect(response.status).not.toBe(403);
    });
  });

  describe('Request Validation Middleware', () => {
    it('should validate required fields in POST requests', async () => {
      const response = await request(app)
        .post('/api/v1/cases/create')
        .set('Authorization', 'Bearer user-token')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation Error',
        message: 'Request validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String)
          })
        ])
      });
    });

    it('should validate field types and formats', async () => {
      const response = await request(app)
        .post('/api/v1/cases/create')
        .set('Authorization', 'Bearer user-token')
        .send({
          title: 123, // Should be string
          location: {
            lat: 'invalid', // Should be number
            lng: 'invalid'  // Should be number
          }
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.stringContaining('string')
          }),
          expect.objectContaining({
            field: 'location.lat',
            message: expect.stringContaining('number')
          })
        ])
      );
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/cases/search')
        .set('Authorization', 'Bearer user-token')
        .query({
          page: 'invalid', // Should be number
          limit: -1        // Should be positive
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
            message: expect.stringContaining('number')
          }),
          expect.objectContaining({
            field: 'limit',
            message: expect.stringContaining('positive')
          })
        ])
      );
    });

    it('should sanitize input data', async () => {
      const response = await request(app)
        .post('/api/v1/cases/create')
        .set('Authorization', 'Bearer user-token')
        .send({
          title: '  Test Case  ', // Should be trimmed
          description: '<script>alert("xss")</script>Test', // Should be sanitized
          location: {
            lat: 24.8138,
            lng: 120.9675
          }
        })
        .expect(201);

      expect(response.body.data.title).toBe('Test Case');
      expect(response.body.data.description).not.toContain('<script>');
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle 404 errors for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: '/api/v1/nonexistent'
      });
    });

    it('should handle internal server errors gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/test/error')
        .set('Authorization', 'Bearer valid-token')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        requestId: expect.any(String)
      });
    });

    it('should not expose sensitive error details in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/v1/test/database-error')
        .set('Authorization', 'Bearer valid-token')
        .expect(500);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.message).not.toContain('database');

      process.env.NODE_ENV = 'test';
    });

    it('should log errors with appropriate context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await request(app)
        .get('/api/v1/test/error')
        .set('Authorization', 'Bearer valid-token')
        .expect(500);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          requestId: expect.any(String),
          path: '/api/v1/test/error',
          userId: expect.any(String)
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/v1/rbac/roles')
          .set('Authorization', 'Bearer valid-token');

        expect(response.status).not.toBe(429);
      }
    });

    it('should reject requests exceeding rate limit', async () => {
      // Make many requests to exceed rate limit
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/v1/rbac/roles')
          .set('Authorization', 'Bearer valid-token');
      }

      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-token')
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        error: 'Rate Limit Exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: expect.any(Number)
      });
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-token');

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('CORS Middleware', () => {
    it('should include CORS headers for valid origins', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-token')
        .set('Origin', 'https://app.hsinchu.gov.tw');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/v1/cases/create')
        .set('Origin', 'https://app.hsinchu.gov.tw')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
        .expect(200);

      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-token')
        .set('Origin', 'https://malicious-site.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Security Headers Middleware', () => {
    it('should include security headers in all responses', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-token');

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should set appropriate content security policy', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-token');

      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });
});