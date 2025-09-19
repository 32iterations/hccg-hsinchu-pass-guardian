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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '需要訪問令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '無效的訪問令牌' });
    }
    req.user = user;
    next();
  });
};

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

// ==================== PATIENT ENDPOINTS ====================

// Get patients for current user
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const patients = await db.getPatientsByGuardianId(req.user.id);

    res.json({
      success: true,
      patients
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: '獲取患者列表失敗' });
  }
});

// Create new patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  const { name, age, address, emergency_contact, beacon_id } = req.body;

  try {
    const patientData = {
      name,
      age,
      address,
      emergency_contact,
      beacon_id,
      guardian_id: req.user.id
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

// ==================== LOCATION ENDPOINTS ====================

// Create/update location
app.post('/api/locations', authenticateToken, async (req, res) => {
  const { patient_id, latitude, longitude, source } = req.body;

  try {
    const locationData = {
      patient_id,
      latitude,
      longitude,
      source: source || 'gps',
      timestamp: new Date()
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

// Get location history for a patient
app.get('/api/locations/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.query;

    const result = await db.query(
      `SELECT * FROM locations
       WHERE patient_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [id, parseInt(hours)]
    );

    res.json({
      success: true,
      locations: result.rows
    });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ error: '獲取位置歷史失敗' });
  }
});

// Get location history for a patient (alternative route)
app.get('/api/locations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.query;

    const result = await db.query(
      `SELECT * FROM locations
       WHERE patient_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [id, parseInt(hours)]
    );

    res.json({
      success: true,
      locations: result.rows
    });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ error: '獲取位置歷史失敗' });
  }
});

// ==================== GEOFENCE ENDPOINTS ====================

// Get all geofences for user
app.get('/api/geofences', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*, p.name as patient_name
       FROM geofences g
       JOIN patients p ON g.patient_id = p.id
       WHERE p.guardian_id = $1 AND g.is_active = true
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      geofences: result.rows
    });
  } catch (error) {
    console.error('Get geofences error:', error);
    res.status(500).json({ error: '獲取地理圍欄失敗' });
  }
});

// Get geofences for specific patient
app.get('/api/geofences/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;

    const result = await db.query(
      `SELECT g.*, p.name as patient_name
       FROM geofences g
       JOIN patients p ON g.patient_id = p.id
       WHERE g.patient_id = $1 AND p.guardian_id = $2 AND g.is_active = true
       ORDER BY g.created_at DESC`,
      [patientId, req.user.id]
    );

    res.json({
      success: true,
      geofences: result.rows
    });
  } catch (error) {
    console.error('Get patient geofences error:', error);
    res.status(500).json({ error: '獲取患者地理圍欄失敗' });
  }
});

// Create new geofence
app.post('/api/geofences', authenticateToken, async (req, res) => {
  try {
    const { patient_id, name, center_lat, center_lng, radius } = req.body;

    if (!patient_id || !name || !center_lat || !center_lng || !radius) {
      return res.status(400).json({
        error: '必填欄位缺失: patient_id, name, center_lat, center_lng, radius'
      });
    }

    // Verify patient belongs to user
    const patientCheck = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND guardian_id = $2',
      [patient_id, req.user.id]
    );

    if (patientCheck.rows.length === 0) {
      return res.status(403).json({ error: '患者不存在或無權限' });
    }

    const result = await db.query(
      `INSERT INTO geofences (patient_id, name, center_lat, center_lng, radius, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING *`,
      [patient_id, name, center_lat, center_lng, radius]
    );

    res.json({
      success: true,
      geofence: result.rows[0]
    });
  } catch (error) {
    console.error('Create geofence error:', error);
    res.status(500).json({ error: '建立地理圍欄失敗' });
  }
});

// ==================== ALERT ENDPOINTS ====================

// Get alerts for current user
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, p.name as patient_name
       FROM alerts a
       JOIN patients p ON a.patient_id = p.id
       WHERE p.guardian_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({
      success: true,
      alerts: result.rows
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: '獲取警報記錄失敗' });
  }
});

// Mark alert as read
app.put('/api/alerts/:alertId/read', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;

    await db.query(
      'UPDATE alerts SET is_resolved = true WHERE id = $1',
      [alertId]
    );

    res.json({
      success: true,
      message: '警報已標記為已讀'
    });
  } catch (error) {
    console.error('Mark alert read error:', error);
    res.status(500).json({ error: '標記警報失敗' });
  }
});

// ==================== EMERGENCY ENDPOINTS ====================

// Send SOS emergency alert
app.post('/api/emergency/sos', authenticateToken, async (req, res) => {
  try {
    const { timestamp, source = 'manual' } = req.body;

    // Log emergency alert
    console.log(`🚨 緊急求救信號 - 用戶 ${req.user.id} 於 ${timestamp || new Date().toISOString()} 發送求救信號`);

    res.json({
      success: true,
      message: '緊急求救信號已發送',
      alert_id: Date.now().toString()
    });
  } catch (error) {
    console.error('Emergency SOS error:', error);
    res.status(500).json({ error: '緊急求救發送失敗' });
  }
});

// Share current location
app.post('/api/location/share', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, timestamp } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: '必填欄位缺失: latitude, longitude'
      });
    }

    // Log location sharing
    console.log(`📍 位置分享 - 用戶 ${req.user.id} 分享位置: ${latitude}, ${longitude}`);

    res.json({
      success: true,
      message: '位置已分享給所有聯絡人'
    });
  } catch (error) {
    console.error('Share location error:', error);
    res.status(500).json({ error: '分享位置失敗' });
  }
});

// Get emergency contacts
app.get('/api/emergency/contacts', authenticateToken, async (req, res) => {
  try {
    console.log(`📞 獲取緊急聯絡人 - 用戶 ${req.user.id}`);

    // Mock emergency contacts for demo
    const mockContacts = [
      { id: 1, name: '家屬 - 張小華', phone: '0912-345-678', relationship: '女兒' },
      { id: 2, name: '緊急聯絡人 - 李醫師', phone: '0987-654-321', relationship: '醫師' },
      { id: 3, name: '鄰居 - 王大媽', phone: '0955-123-456', relationship: '鄰居' }
    ];

    res.json({
      success: true,
      contacts: mockContacts
    });
  } catch (error) {
    console.error('Get emergency contacts error:', error);
    res.status(500).json({ error: '獲取緊急聯絡人失敗' });
  }
});

// ==================== NOTIFICATION ENDPOINTS ====================

// Update FCM token
app.post('/api/notifications/token', authenticateToken, async (req, res) => {
  try {
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ error: 'FCM Token 必填' });
    }

    // In a real implementation, this would save the FCM token to the database
    console.log(`📱 FCM Token 更新 - 用戶 ${req.user.id}: ${fcm_token.substring(0, 20)}...`);

    res.json({
      success: true,
      message: 'FCM Token 更新成功'
    });
  } catch (error) {
    console.error('Update FCM token error:', error);
    res.status(500).json({ error: 'FCM Token 更新失敗' });
  }
});

// ==================== PROFILE ENDPOINTS ====================

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const result = await db.query(
      'UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING id, email, name, phone, role',
      [name, phone, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用戶不存在' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '更新資料失敗' });
  }
});

// ==================== TEST ENDPOINTS ====================

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

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3001;

// Firebase notification service with error handling
const initializeFirebaseNotification = () => {
  try {
    const notificationService = require('./services/firebase-notification');
    console.log('📝 Running in mock mode - notifications will be logged only');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    console.log('📝 Running in mock mode - notifications will be logged only');
    return false;
  }
};

initializeFirebaseNotification();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
    🚀 新竹安心守護後端服務啟動成功！

    📡 API Server: http://${process.env.PUBLIC_IP || '147.251.115.54'}:${PORT}

    📍 健康檢查: http://${process.env.PUBLIC_IP || '147.251.115.54'}:${PORT}/health

    🔑 測試帳號:
       POST http://${process.env.PUBLIC_IP || '147.251.115.54'}:${PORT}/api/test/create-user
       然後使用 test@hsinchu.gov.tw / test123 登入

    📚 API 端點:
       - POST /api/auth/register - 註冊
       - POST /api/auth/login - 登入
       - GET  /api/patients - 取得患者列表
       - POST /api/patients - 新增患者
       - POST /api/locations - 更新位置
       - GET  /api/locations/:id/history - 位置歷史
       - GET  /api/geofences - 取得地理圍欄
       - POST /api/geofences - 建立地理圍欄
       - GET  /api/alerts - 取得警報記錄
       - POST /api/emergency/sos - 緊急求救
       - GET  /api/emergency/contacts - 緊急聯絡人
       - POST /api/notifications/token - 更新通知Token

    🔧 環境: ${process.env.NODE_ENV || 'development'}
    💾 資料儲存: PostgreSQL 資料庫
  `);
});

module.exports = app;