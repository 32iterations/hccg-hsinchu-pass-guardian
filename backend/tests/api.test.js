const request = require('supertest');
const app = require('../server-simple');
const db = require('../services/database');

describe('API Integration Tests', () => {
  let authToken;
  let userId;
  let patientId;

  beforeEach(async () => {
    // Clean up database before each test
    await db.query('TRUNCATE TABLE locations, alerts, geofences, patients, users RESTART IDENTITY CASCADE');
  });

  describe('Health Check', () => {
    test('GET /health should return status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', '新竹安心守護 API');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication', () => {
    describe('POST /api/auth/register', () => {
      test('should register a new user successfully', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'password123',
          name: '測試用戶',
          role: 'family',
          phone: '0912345678'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.email).toBe(userData.email);
        expect(response.body.user.name).toBe(userData.name);
        expect(response.body.user.role).toBe(userData.role);

        // Save for other tests
        authToken = response.body.token;
        userId = response.body.user.id;
      });

      test('should not register user with existing email', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'password123',
          name: '測試用戶',
          role: 'family',
          phone: '0912345678'
        };

        // Register first user
        await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(200);

        // Try to register with same email
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.error).toBe('此電子郵件已被註冊');
      });
    });

    describe('POST /api/auth/login', () => {
      beforeEach(async () => {
        // Register a user first
        const userData = {
          email: 'test@example.com',
          password: 'password123',
          name: '測試用戶',
          role: 'family',
          phone: '0912345678'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        userId = response.body.user.id;
      });

      test('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe('test@example.com');

        authToken = response.body.token;
      });

      test('should not login with invalid email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'notexist@example.com',
            password: 'password123'
          })
          .expect(401);

        expect(response.body.error).toBe('帳號或密碼錯誤');
      });

      test('should not login with invalid password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body.error).toBe('帳號或密碼錯誤');
      });
    });
  });

  describe('Patient Management', () => {
    beforeEach(async () => {
      // Register and login user
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = response.body.token;
      userId = response.body.user.id;
    });

    describe('POST /api/patients', () => {
      test('should create a new patient', async () => {
        const patientData = {
          name: '患者姓名',
          age: 75,
          address: '新竹市東區',
          emergency_contact: '0987654321',
          beacon_id: 'beacon-001'
        };

        const response = await request(app)
          .post('/api/patients')
          .set('Authorization', `Bearer ${authToken}`)
          .send(patientData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.patient).toHaveProperty('id');
        expect(response.body.patient.name).toBe(patientData.name);
        expect(response.body.patient.age).toBe(patientData.age);
        expect(response.body.patient.guardian_id).toBe(userId);

        patientId = response.body.patient.id;
      });

      test('should require authentication', async () => {
        const patientData = {
          name: '患者姓名',
          age: 75,
          address: '新竹市東區',
          emergency_contact: '0987654321',
          beacon_id: 'beacon-001'
        };

        await request(app)
          .post('/api/patients')
          .send(patientData)
          .expect(401);
      });
    });

    describe('GET /api/patients', () => {
      beforeEach(async () => {
        // Create a patient
        const patientData = {
          name: '患者姓名',
          age: 75,
          address: '新竹市東區',
          emergency_contact: '0987654321',
          beacon_id: 'beacon-001'
        };

        const response = await request(app)
          .post('/api/patients')
          .set('Authorization', `Bearer ${authToken}`)
          .send(patientData);

        patientId = response.body.patient.id;
      });

      test('should get patients for authenticated user', async () => {
        const response = await request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.patients).toHaveLength(1);
        expect(response.body.patients[0].name).toBe('患者姓名');
        expect(response.body.patients[0].guardian_id).toBe(userId);
      });

      test('should require authentication', async () => {
        await request(app)
          .get('/api/patients')
          .expect(401);
      });
    });
  });

  describe('Location Management', () => {
    beforeEach(async () => {
      // Register user and create patient
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = userResponse.body.token;
      userId = userResponse.body.user.id;

      const patientData = {
        name: '患者姓名',
        age: 75,
        address: '新竹市東區',
        emergency_contact: '0987654321',
        beacon_id: 'beacon-001'
      };

      const patientResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData);

      patientId = patientResponse.body.patient.id;
    });

    describe('POST /api/locations', () => {
      test('should create a new location', async () => {
        const locationData = {
          patient_id: patientId,
          latitude: 24.8047,
          longitude: 120.9714,
          accuracy: 5.0,
          battery_level: 85
        };

        const response = await request(app)
          .post('/api/locations')
          .set('Authorization', `Bearer ${authToken}`)
          .send(locationData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.location).toHaveProperty('id');
        expect(response.body.location.patient_id).toBe(patientId);
        expect(parseFloat(response.body.location.latitude)).toBe(locationData.latitude);
        expect(parseFloat(response.body.location.longitude)).toBe(locationData.longitude);
        expect(response.body.location.battery_level).toBe(locationData.battery_level);
      });

      test('should require authentication', async () => {
        const locationData = {
          patient_id: patientId,
          latitude: 24.8047,
          longitude: 120.9714,
          accuracy: 5.0,
          battery_level: 85
        };

        await request(app)
          .post('/api/locations')
          .send(locationData)
          .expect(401);
      });
    });

    describe('GET /api/locations/:patientId/history', () => {
      beforeEach(async () => {
        // Create some location data
        const locationData1 = {
          patient_id: patientId,
          latitude: 24.8047,
          longitude: 120.9714,
          accuracy: 5.0,
          battery_level: 85
        };

        const locationData2 = {
          patient_id: patientId,
          latitude: 24.8048,
          longitude: 120.9715,
          accuracy: 6.0,
          battery_level: 84
        };

        await request(app)
          .post('/api/locations')
          .set('Authorization', `Bearer ${authToken}`)
          .send(locationData1);

        await request(app)
          .post('/api/locations')
          .set('Authorization', `Bearer ${authToken}`)
          .send(locationData2);
      });

      test('should get location history for patient', async () => {
        const response = await request(app)
          .get(`/api/locations/${patientId}/history`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.locations).toHaveLength(2);
        expect(response.body.locations[0].patient_id).toBe(patientId);
        // Should be ordered by timestamp DESC (latest first)
        expect(parseFloat(response.body.locations[0].latitude)).toBe(24.8048);
      });

      test('should require authentication', async () => {
        await request(app)
          .get(`/api/locations/${patientId}/history`)
          .expect(401);
      });
    });
  });

  describe('FCM Token Registration', () => {
    beforeEach(async () => {
      // Register and login user
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = response.body.token;
      userId = response.body.user.id;
    });

    test('should register FCM token', async () => {
      const response = await request(app)
        .post('/api/notifications/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fcm_token: 'test-fcm-token-123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('FCM token registered successfully');
    });

    test('should require FCM token', async () => {
      const response = await request(app)
        .post('/api/notifications/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('FCM token required');
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/notifications/register')
        .send({ fcm_token: 'test-fcm-token-123' })
        .expect(401);
    });
  });

  describe('Test Data Creation', () => {
    test('POST /api/test/create-user should create test user', async () => {
      const response = await request(app)
        .post('/api/test/create-user')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('測試用戶已創建');
      expect(response.body.credentials.email).toBe('test@hsinchu.gov.tw');
      expect(response.body.credentials.password).toBe('test123');

      // Test login with created user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@hsinchu.gov.tw',
          password: 'test123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.user.email).toBe('test@hsinchu.gov.tw');
    });
  });
});