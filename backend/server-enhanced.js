const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Import database service and routes
const db = require('./services/database');

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

// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  try {
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '此電子郵件已被註冊' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
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

// ==================== PROTECTED TEST ENDPOINT ====================
app.get('/api/auth/test', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==================== MOCK DATA ====================
const mockPatients = [
  {
    id: '1',
    name: '王大明',
    age: 75,
    address: '新竹市東區光復路100號',
    emergency_contact: '0912-345-678',
    beacon_id: 'BEACON-001',
    status: 'safe',
    guardian_id: 3
  },
  {
    id: '2',
    name: '李美玲',
    age: 68,
    address: '新竹市北區中正路200號',
    emergency_contact: '0923-456-789',
    beacon_id: 'BEACON-002',
    status: 'safe',
    guardian_id: 3
  }
];

const mockGeofences = [
  {
    id: '1',
    name: '家',
    center_lat: 24.8066,
    center_lng: 120.9686,
    radius: 100,
    active: true,
    patient_id: '1'
  },
  {
    id: '2',
    name: '公園',
    center_lat: 24.8070,
    center_lng: 120.9690,
    radius: 150,
    active: true,
    patient_id: '1'
  }
];

const mockLocationHistory = [
  {
    id: '1',
    latitude: 24.8066,
    longitude: 120.9686,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    accuracy: 10
  },
  {
    id: '2',
    latitude: 24.8067,
    longitude: 120.9687,
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    accuracy: 12
  },
  {
    id: '3',
    latitude: 24.8068,
    longitude: 120.9688,
    timestamp: new Date().toISOString(),
    accuracy: 8
  }
];

const mockAlerts = [
  {
    id: '1',
    type: 'geofence_exit',
    title: '離開安全區域',
    message: '王大明已離開「家」的安全區域',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    is_read: false,
    patient_id: '1'
  },
  {
    id: '2',
    type: 'low_battery',
    title: '電量過低',
    message: '李美玲的裝置電量低於20%',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    is_read: true,
    patient_id: '2'
  }
];

// ==================== PATIENT ENDPOINTS ====================

// Get all patients (with mock data fallback)
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    // Return mock data for now
    const patients = mockPatients.filter(p => p.guardian_id === req.user.id);
    res.json({ success: true, patients });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.json({ success: true, patients: mockPatients });
  }
});

// Add patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  const { name, age, address, emergency_contact, beacon_id } = req.body;

  try {
    const newPatient = {
      id: Date.now().toString(),
      name,
      age,
      address,
      emergency_contact,
      beacon_id,
      status: 'safe',
      guardian_id: req.user.id
    };

    mockPatients.push(newPatient);
    res.json({ success: true, patient: newPatient });
  } catch (error) {
    console.error('Error adding patient:', error);
    res.status(500).json({ error: '新增失敗' });
  }
});

// ==================== GEOFENCE ENDPOINTS ====================

// Get geofences for a patient
app.get('/api/geofences/:patientId', authenticateToken, (req, res) => {
  const { patientId } = req.params;
  const geofences = mockGeofences.filter(g => g.patient_id === patientId);
  res.json({ success: true, geofences });
});

// Create geofence
app.post('/api/geofences', authenticateToken, (req, res) => {
  const { patient_id, name, center_lat, center_lng, radius } = req.body;

  const newGeofence = {
    id: Date.now().toString(),
    patient_id,
    name,
    center_lat,
    center_lng,
    radius,
    active: true
  };

  mockGeofences.push(newGeofence);
  res.json({ success: true, geofence: newGeofence });
});

// ==================== LOCATION ENDPOINTS ====================

// Get location history
app.get('/api/locations/:patientId/history', authenticateToken, (req, res) => {
  const { hours = 24 } = req.query;
  res.json({ success: true, locations: mockLocationHistory });
});

// Update patient location
app.post('/api/locations/update', authenticateToken, (req, res) => {
  const { patient_id, latitude, longitude, source } = req.body;

  const newLocation = {
    id: Date.now().toString(),
    patient_id,
    latitude,
    longitude,
    source,
    timestamp: new Date().toISOString(),
    accuracy: 10
  };

  mockLocationHistory.unshift(newLocation);
  if (mockLocationHistory.length > 100) {
    mockLocationHistory.pop();
  }

  res.json({ success: true, location: newLocation });
});

// ==================== ALERT ENDPOINTS ====================

// Get alerts
app.get('/api/alerts', authenticateToken, (req, res) => {
  const userPatients = mockPatients.filter(p => p.guardian_id === req.user.id);
  const patientIds = userPatients.map(p => p.id);
  const alerts = mockAlerts.filter(a => patientIds.includes(a.patient_id));
  res.json({ success: true, alerts });
});

// Mark alert as read
app.put('/api/alerts/:alertId/read', authenticateToken, (req, res) => {
  const { alertId } = req.params;
  const alert = mockAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.is_read = true;
  }
  res.json({ success: true });
});

// ==================== SOS ENDPOINT ====================

// Send SOS alert
app.post('/api/sos/send', authenticateToken, (req, res) => {
  const { patient_id, location, message } = req.body;

  const newAlert = {
    id: Date.now().toString(),
    type: 'sos',
    title: '緊急求救',
    message: message || '需要立即協助',
    timestamp: new Date().toISOString(),
    is_read: false,
    patient_id,
    location
  };

  mockAlerts.unshift(newAlert);
  res.json({ success: true, alert: newAlert });
});

// ==================== USER PROFILE ENDPOINTS ====================

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (user) {
      delete user.password_hash;
      res.json({ success: true, user });
    } else {
      // Return mock user data
      res.json({
        success: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: '測試用戶',
          role: req.user.role,
          phone: '0912-345-678'
        }
      });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: '測試用戶',
        role: req.user.role
      }
    });
  }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { name, phone } = req.body;

  try {
    // For now, just return success with updated data
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: name || req.user.name,
        role: req.user.role,
        phone: phone || ''
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: '更新失敗' });
  }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
  console.log(`🔐 JWT Secret configured: ${JWT_SECRET ? 'Yes' : 'No'}`);
  console.log('\n📋 Available endpoints:');
  console.log('  POST /api/auth/register');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/auth/test (requires auth)');
  console.log('  GET  /api/patients (requires auth)');
  console.log('  POST /api/patients (requires auth)');
  console.log('  GET  /api/geofences/:patientId (requires auth)');
  console.log('  POST /api/geofences (requires auth)');
  console.log('  GET  /api/locations/:patientId/history (requires auth)');
  console.log('  POST /api/locations/update (requires auth)');
  console.log('  GET  /api/alerts (requires auth)');
  console.log('  PUT  /api/alerts/:alertId/read (requires auth)');
  console.log('  POST /api/sos/send (requires auth)');
  console.log('  GET  /api/user/profile (requires auth)');
  console.log('  PUT  /api/user/profile (requires auth)');
});

module.exports = app;