const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage (for testing without database)
const users = [];
const patients = [];
const locations = [];

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
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: '此電子郵件已被註冊' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: users.length + 1,
      email,
      password_hash: hashedPassword,
      name,
      role,
      phone,
      created_at: new Date()
    };

    users.push(user);

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
    const user = users.find(u => u.email === email);

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
app.post('/api/patients', authenticateToken, (req, res) => {
  const { name, age, address, emergency_contact, beacon_id } = req.body;

  const patient = {
    id: patients.length + 1,
    name,
    age,
    address,
    guardian_id: req.user.id,
    emergency_contact,
    beacon_id,
    created_at: new Date()
  };

  patients.push(patient);

  res.json({
    success: true,
    patient
  });
});

// Get patients
app.get('/api/patients', authenticateToken, (req, res) => {
  const userPatients = patients.filter(p => p.guardian_id === req.user.id);

  res.json({
    success: true,
    patients: userPatients
  });
});

// ==================== LOCATION ENDPOINTS ====================

// Update location
app.post('/api/locations', authenticateToken, (req, res) => {
  const { patient_id, latitude, longitude, accuracy, battery_level } = req.body;

  const location = {
    id: locations.length + 1,
    patient_id,
    latitude,
    longitude,
    accuracy,
    battery_level,
    timestamp: new Date()
  };

  locations.push(location);

  res.json({
    success: true,
    location
  });
});

// Get location history
app.get('/api/locations/:patientId/history', authenticateToken, (req, res) => {
  const { patientId } = req.params;
  const patientLocations = locations
    .filter(l => l.patient_id === parseInt(patientId))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);

  res.json({
    success: true,
    locations: patientLocations
  });
});

// ==================== TEST DATA ====================

// Create test user
app.post('/api/test/create-user', async (req, res) => {
  const hashedPassword = await bcrypt.hash('test123', 10);

  const testUser = {
    id: users.length + 1,
    email: 'test@hsinchu.gov.tw',
    password_hash: hashedPassword,
    name: '測試用戶',
    role: 'family',
    phone: '0912345678',
    created_at: new Date()
  };

  users.push(testUser);

  res.json({
    success: true,
    message: '測試用戶已創建',
    credentials: {
      email: 'test@hsinchu.gov.tw',
      password: 'test123'
    }
  });
});

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
    💾 資料儲存: 記憶體（重啟會清空）
  `);
});

module.exports = app;