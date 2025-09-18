const request = require('supertest');
const app = require('../../src/app');

describe('RBAC API Endpoints', () => {
  const mockUser = {
    id: 'user123',
    roles: ['family_member'],
    permissions: ['read_own_cases', 'create_cases']
  };

  beforeEach(() => {
    // Mock authentication middleware to set user context
    jest.clearAllMocks();
  });

  describe('GET /api/v1/rbac/roles', () => {
    it('should return all available roles with their permissions', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            permissions: expect.any(Array),
            description: expect.any(String)
          })
        ])
      });
    });

    it('should return 401 when no authorization header is provided', async () => {
      await request(app)
        .get('/api/v1/rbac/roles')
        .expect(401);
    });

    it('should return 403 when user lacks permission to view roles', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/roles')
        .set('Authorization', 'Bearer limited-permission-token')
        .expect(403);

      expect(response.body).toEqual(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });
  });

  describe('POST /api/v1/rbac/roles/assign', () => {
    const assignmentData = {
      userId: 'user456',
      roles: ['volunteer', 'case_worker']
    };

    it('should successfully assign roles to a user', async () => {
      const response = await request(app)
        .post('/api/v1/rbac/roles/assign')
        .set('Authorization', 'Bearer admin-token')
        .send(assignmentData);

      if (response.status !== 200) {
        console.log('Error response:', {
          status: response.status,
          statusType: typeof response.status,
          body: typeof response.body === 'function' ? 'Function' : response.body,
          bodyType: typeof response.body
        });
      }

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Roles assigned successfully',
        data: {
          userId: assignmentData.userId,
          assignedRoles: assignmentData.roles,
          timestamp: expect.any(String)
        }
      });
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/v1/rbac/roles/assign')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(400);
    });

    it('should reject invalid role names', async () => {
      await request(app)
        .post('/api/v1/rbac/roles/assign')
        .set('Authorization', 'Bearer admin-token')
        .send({
          userId: 'user456',
          roles: ['invalid_role', 'another_invalid_role']
        })
        .expect(400);
    });

    it('should require admin permissions for role assignment', async () => {
      await request(app)
        .post('/api/v1/rbac/roles/assign')
        .set('Authorization', 'Bearer user-token')
        .send(assignmentData)
        .expect(403);
    });
  });

  describe('DELETE /api/v1/rbac/roles/remove', () => {
    const removalData = {
      userId: 'user456',
      roles: ['volunteer']
    };

    it('should successfully remove roles from a user', async () => {
      const response = await request(app)
        .delete('/api/v1/rbac/roles/remove')
        .set('Authorization', 'Bearer admin-token')
        .send(removalData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Roles removed successfully',
        data: {
          userId: removalData.userId,
          removedRoles: removalData.roles,
          timestamp: expect.any(String)
        }
      });
    });

    it('should validate user exists before removing roles', async () => {
      await request(app)
        .delete('/api/v1/rbac/roles/remove')
        .set('Authorization', 'Bearer admin-token')
        .send({
          userId: 'nonexistent-user',
          roles: ['volunteer']
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/rbac/permissions/validate', () => {
    it('should validate user permissions for specific actions', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/permissions/validate')
        .set('Authorization', 'Bearer user-token')
        .query({
          action: 'create_case',
          resource: 'cases',
          resourceId: 'case123'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          hasPermission: expect.any(Boolean),
          permissions: expect.any(Array),
          reason: expect.any(String)
        }
      });
    });

    it('should require action parameter', async () => {
      await request(app)
        .get('/api/v1/rbac/permissions/validate')
        .set('Authorization', 'Bearer user-token')
        .expect(400);
    });
  });

  describe('GET /api/v1/rbac/audit-trail', () => {
    it('should return audit trail for role assignments', async () => {
      const response = await request(app)
        .get('/api/v1/rbac/audit-trail')
        .set('Authorization', 'Bearer admin-token')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          userId: 'user123'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          auditLog: expect.any(Array),
          pagination: expect.objectContaining({
            total: expect.any(Number),
            page: expect.any(Number),
            limit: expect.any(Number)
          })
        }
      });
    });

    it('should support pagination', async () => {
      await request(app)
        .get('/api/v1/rbac/audit-trail')
        .set('Authorization', 'Bearer admin-token')
        .query({
          page: 2,
          limit: 10
        })
        .expect(200);
    });

    it('should require admin permissions for audit trail access', async () => {
      await request(app)
        .get('/api/v1/rbac/audit-trail')
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });
  });
});