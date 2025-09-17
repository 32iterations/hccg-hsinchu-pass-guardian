const request = require('supertest');
const app = require('../../src/app');

describe('Case Flow API Endpoints', () => {
  const mockCase = {
    id: 'case123',
    title: '失智長者走失案件',
    description: '78歲陳老先生在大潤發走失',
    status: 'active',
    priority: 'high',
    createdBy: 'user123',
    assignedTo: 'volunteer456',
    location: {
      lat: 24.8138,
      lng: 120.9675,
      address: '新竹市東區光復路二段101號'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/cases/create', () => {
    const caseData = {
      title: '失智長者走失案件',
      description: '78歲陳老先生在大潤發走失',
      priority: 'high',
      location: {
        lat: 24.8138,
        lng: 120.9675,
        address: '新竹市東區光復路二段101號'
      },
      contactInfo: {
        name: '陳小華',
        phone: '0912345678',
        relationship: '女兒'
      },
      missingPerson: {
        name: '陳老先生',
        age: 78,
        description: '身高約165cm，穿深色衣服',
        lastSeen: '2023-10-15T14:30:00Z'
      }
    };

    it('should create a new case successfully', async () => {
      const response = await request(app)
        .post('/api/v1/cases/create')
        .set('Authorization', 'Bearer admin-token')
        .send(caseData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Case created successfully',
        data: {
          id: expect.any(String),
          ...caseData,
          status: 'active',
          createdAt: expect.any(String),
          createdBy: expect.any(String)
        }
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/cases/create')
        .set('Authorization', 'Bearer family-member-token')
        .send({})
        .expect(400);

      expect(response.body.errors).toContain('Title is required');
    });

    it('should validate location coordinates', async () => {
      await request(app)
        .post('/api/v1/cases/create')
        .set('Authorization', 'Bearer family-member-token')
        .send({
          ...caseData,
          location: {
            lat: 'invalid',
            lng: 'invalid'
          }
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/cases/create')
        .send(caseData)
        .expect(401);
    });
  });

  describe('GET /api/v1/cases/:id', () => {
    it('should return case details for authorized user', async () => {
      const response = await request(app)
        .get('/api/v1/cases/case123')
        .set('Authorization', 'Bearer family-member-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'case123',
          title: expect.any(String),
          description: expect.any(String),
          status: expect.any(String),
          location: expect.any(Object),
          createdAt: expect.any(String)
        })
      });
    });

    it('should return 404 for non-existent case', async () => {
      await request(app)
        .get('/api/v1/cases/nonexistent')
        .set('Authorization', 'Bearer family-member-token')
        .expect(404);
    });

    it('should enforce access control based on case ownership', async () => {
      await request(app)
        .get('/api/v1/cases/case123')
        .set('Authorization', 'Bearer unauthorized-user-token')
        .expect(403);
    });
  });

  describe('PUT /api/v1/cases/:id/status', () => {
    const statusUpdate = {
      status: 'resolved',
      resolution: 'Person found safely',
      resolvedBy: 'volunteer456',
      resolvedAt: '2023-10-15T18:30:00Z'
    };

    it('should update case status successfully', async () => {
      const response = await request(app)
        .put('/api/v1/cases/case123/status')
        .set('Authorization', 'Bearer volunteer-token')
        .send(statusUpdate)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Case status updated successfully',
        data: {
          id: 'case123',
          previousStatus: expect.any(String),
          newStatus: statusUpdate.status,
          updatedAt: expect.any(String),
          updatedBy: expect.any(String)
        }
      });
    });

    it('should validate status transitions', async () => {
      await request(app)
        .put('/api/v1/cases/case123/status')
        .set('Authorization', 'Bearer volunteer-token')
        .send({
          status: 'invalid_status'
        })
        .expect(400);
    });

    it('should require appropriate permissions for status updates', async () => {
      await request(app)
        .put('/api/v1/cases/case123/status')
        .set('Authorization', 'Bearer unauthorized-token')
        .send(statusUpdate)
        .expect(403);
    });
  });

  describe('GET /api/v1/cases/search', () => {
    it('should search cases with filters', async () => {
      const response = await request(app)
        .get('/api/v1/cases/search')
        .set('Authorization', 'Bearer volunteer-token')
        .query({
          status: 'active',
          priority: 'high',
          location: '新竹市',
          radius: 5000
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          cases: expect.any(Array),
          pagination: expect.objectContaining({
            total: expect.any(Number),
            page: expect.any(Number),
            limit: expect.any(Number)
          }),
          filters: expect.any(Object)
        }
      });
    });

    it('should support geographic search', async () => {
      await request(app)
        .get('/api/v1/cases/search')
        .set('Authorization', 'Bearer volunteer-token')
        .query({
          lat: 24.8138,
          lng: 120.9675,
          radius: 10000
        })
        .expect(200);
    });

    it('should support pagination', async () => {
      await request(app)
        .get('/api/v1/cases/search')
        .set('Authorization', 'Bearer volunteer-token')
        .query({
          page: 2,
          limit: 20
        })
        .expect(200);
    });
  });

  describe('POST /api/v1/cases/:id/assign', () => {
    const assignmentData = {
      assigneeId: 'volunteer456',
      assigneeType: 'volunteer',
      notes: 'Volunteer has experience with elderly cases'
    };

    it('should assign case to volunteer successfully', async () => {
      const response = await request(app)
        .post('/api/v1/cases/case123/assign')
        .set('Authorization', 'Bearer case-manager-token')
        .send(assignmentData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Case assigned successfully',
        data: {
          caseId: 'case123',
          assignedTo: assignmentData.assigneeId,
          assignedBy: expect.any(String),
          assignedAt: expect.any(String),
          previousAssignee: expect.any(String)
        }
      });
    });

    it('should validate assignee exists and is eligible', async () => {
      await request(app)
        .post('/api/v1/cases/case123/assign')
        .set('Authorization', 'Bearer case-manager-token')
        .send({
          assigneeId: 'nonexistent-volunteer'
        })
        .expect(404);
    });

    it('should check volunteer availability', async () => {
      await request(app)
        .post('/api/v1/cases/case123/assign')
        .set('Authorization', 'Bearer case-manager-token')
        .send({
          assigneeId: 'unavailable-volunteer'
        })
        .expect(409);
    });

    it('should require case management permissions', async () => {
      await request(app)
        .post('/api/v1/cases/case123/assign')
        .set('Authorization', 'Bearer volunteer-token')
        .send(assignmentData)
        .expect(403);
    });
  });
});