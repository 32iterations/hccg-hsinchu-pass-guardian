const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Import database service and routes
const db = require('./services/database');
const geofenceRoutes = require('./routes/geofence');

// Middleware
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'hsinchu-guardian-secret-2025';

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '新竹安心守護 API',
    timestamp: new Date().toISOString(),
    ip: process.env.PUBLIC_IP
  });
});

// ==================== AUTH ENDPOINTS ====================

// User Registration (Simplified)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  try {
    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '此電子郵件已被註冊' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      email,
      password_hash: hashedPassword,
      name,
      role,
      phone
    };

    const user = await db.createUser(userData);

    const token = jwt.sign(
      { id: user.id, email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '註冊失敗' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登入失敗' });
  }
});

// ==================== MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ==================== PATIENT ENDPOINTS ====================

// Add patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  const { name, age, address, emergency_contact, beacon_id } = req.body;

  try {
    const patientData = {
      name,
      age,
      address,
      guardian_id: req.user.id,
      emergency_contact,
      beacon_id
    };

    const patient = await db.createPatient(patientData);

    res.json({
      success: true,
      patient
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: '創建患者失敗' });
  }
});

// Get patients
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const userPatients = await db.getPatientsByGuardianId(req.user.id);

    res.json({
      success: true,
      patients: userPatients
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: '獲取患者列表失敗' });
  }
});

// ==================== LOCATION ENDPOINTS ====================

// Update location
app.post('/api/locations', authenticateToken, async (req, res) => {
  const { patient_id, latitude, longitude, accuracy, battery_level } = req.body;

  try {
    const locationData = {
      patient_id,
      latitude,
      longitude,
      accuracy,
      battery_level
    };

    const location = await db.createLocation(locationData);

    res.json({
      success: true,
      location
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ error: '創建位置記錄失敗' });
  }
});

// Get location history
app.get('/api/locations/:patientId/history', authenticateToken, async (req, res) => {
  const { patientId } = req.params;

  try {
    const patientLocations = await db.getLocationHistory(parseInt(patientId), 100);

    res.json({
      success: true,
      locations: patientLocations
    });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ error: '獲取位置歷史失敗' });
  }
});

// ==================== TEST DATA ====================

// Create test user (NO AUTH REQUIRED)
app.post('/api/test/create-user', async (req, res) => {
  try {
    // Check if test user already exists
    const existingUser = await db.getUserByEmail('test@hsinchu.gov.tw');
    if (existingUser) {
      return res.json({
        success: true,
        message: '測試用戶已存在',
        credentials: {
          email: 'test@hsinchu.gov.tw',
          password: 'test123'
        }
      });
    }

    const hashedPassword = await bcrypt.hash('test123', 10);

    const testUserData = {
      email: 'test@hsinchu.gov.tw',
      password_hash: hashedPassword,
      name: '測試用戶',
      role: 'family',
      phone: '0912345678'
    };

    await db.createUser(testUserData);

    res.json({
      success: true,
      message: '測試用戶已創建',
      credentials: {
        email: 'test@hsinchu.gov.tw',
        password: 'test123'
      }
    });
  } catch (error) {
    console.error('Create test user error:', error);
    res.status(500).json({ error: '創建測試用戶失敗' });
  }
});

// ==================== PUSH NOTIFICATION ====================
const notificationService = require('./services/firebase-notification');

// Register FCM token
app.post('/api/notifications/register', authenticateToken, async (req, res) => {
  const { fcm_token } = req.body;

  if (!fcm_token) {
    return res.status(400).json({ error: 'FCM token required' });
  }

  try {
    // Update FCM token in database
    await db.updateUserFCMToken(req.user.id, fcm_token);

    // Also register with notification service if available
    if (notificationService && notificationService.registerToken) {
      await notificationService.registerToken(req.user.id, fcm_token);
    }

    res.json({
      success: true,
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    console.error('FCM registration error:', error);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
});

// ==================== GEOFENCE ROUTES ====================
// Apply authentication middleware and mount geofence routes
app.use('/api', authenticateToken, geofenceRoutes);

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
    🚀 新竹安心守護後端服務啟動成功！

    📡 API Server: http://${process.env.PUBLIC_IP}:${PORT}

    📍 健康檢查: http://${process.env.PUBLIC_IP}:${PORT}/health

    🔑 測試帳號:
       POST http://${process.env.PUBLIC_IP}:${PORT}/api/test/create-user
       然後使用 test@hsinchu.gov.tw / test123 登入

    📚 API 端點:
       - POST /api/auth/register - 註冊
       - POST /api/auth/login - 登入
       - GET  /api/patients - 取得患者列表
       - POST /api/patients - 新增患者
       - POST /api/locations - 更新位置
       - GET  /api/locations/:id/history - 位置歷史

    🔧 環境: ${process.env.NODE_ENV || 'development'}
    💾 資料儲存: PostgreSQL 資料庫
  `);
});

module.exports = app;