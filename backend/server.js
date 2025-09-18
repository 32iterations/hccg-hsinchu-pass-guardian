const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');

// Initialize Firebase Admin
const serviceAccount = require('../config/firebase-admin.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection (PostgreSQL)
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hsinchu_guardian',
  password: 'postgres',
  port: 5432,
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'hsinchu-guardian-secret-2025';

// WebSocket connections
const clients = new Map();

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'auth' && data.userId) {
        clients.set(data.userId, ws);
        console.log(`User ${data.userId} connected`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    // Remove client from map
    for (const [userId, client] of clients.entries()) {
      if (client === ws) {
        clients.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// Middleware to verify JWT token
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

// ==================== AUTH ENDPOINTS ====================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role, phone } = req.body;

  try {
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: '此電子郵件已被註冊' });
    }

    // Create Firebase user
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Hash password for database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store in database
    const result = await pool.query(
      `INSERT INTO users (firebase_uid, email, password_hash, name, role, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, name, role`,
      [firebaseUser.uid, email, hashedPassword, name, role, phone]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: result.rows[0]
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
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
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

// ==================== PATIENT MANAGEMENT ====================

// Add new patient
app.post('/api/patients', authenticateToken, async (req, res) => {
  const { name, age, address, emergency_contact, beacon_id } = req.body;
  const guardian_id = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO patients (name, age, address, guardian_id, emergency_contact, beacon_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [name, age, address, guardian_id, emergency_contact, beacon_id]
    );

    res.json({
      success: true,
      patient: result.rows[0]
    });
  } catch (error) {
    console.error('Add patient error:', error);
    res.status(500).json({ error: '新增失敗' });
  }
});

// Get patients list
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM patients WHERE guardian_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      patients: result.rows
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: '查詢失敗' });
  }
});

// ==================== LOCATION TRACKING ====================

// Update patient location
app.post('/api/locations', authenticateToken, async (req, res) => {
  const { patient_id, latitude, longitude, accuracy, battery_level } = req.body;

  try {
    // Store location
    const result = await pool.query(
      `INSERT INTO locations (patient_id, latitude, longitude, accuracy, battery_level, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [patient_id, latitude, longitude, accuracy, battery_level]
    );

    // Check geofence
    const geofences = await pool.query(
      'SELECT * FROM geofences WHERE patient_id = $1 AND is_active = true',
      [patient_id]
    );

    for (const fence of geofences.rows) {
      const distance = calculateDistance(
        latitude, longitude,
        fence.center_lat, fence.center_lng
      );

      if (distance > fence.radius) {
        // Send alert
        await sendGeofenceAlert(patient_id, fence.id, latitude, longitude);
      }
    }

    // Broadcast location update via WebSocket
    const patient = await pool.query(
      'SELECT guardian_id FROM patients WHERE id = $1',
      [patient_id]
    );

    if (patient.rows.length > 0) {
      const guardianWs = clients.get(patient.rows[0].guardian_id.toString());
      if (guardianWs && guardianWs.readyState === WebSocket.OPEN) {
        guardianWs.send(JSON.stringify({
          type: 'location_update',
          data: result.rows[0]
        }));
      }
    }

    res.json({
      success: true,
      location: result.rows[0]
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: '位置更新失敗' });
  }
});

// Get location history
app.get('/api/locations/:patientId/history', authenticateToken, async (req, res) => {
  const { patientId } = req.params;
  const { date } = req.query;

  try {
    let query = `
      SELECT * FROM locations
      WHERE patient_id = $1
    `;
    const params = [patientId];

    if (date) {
      query += ` AND DATE(timestamp) = $2`;
      params.push(date);
    }

    query += ` ORDER BY timestamp DESC LIMIT 1000`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      locations: result.rows
    });
  } catch (error) {
    console.error('Get location history error:', error);
    res.status(500).json({ error: '查詢失敗' });
  }
});

// ==================== GEOFENCE MANAGEMENT ====================

// Create geofence
app.post('/api/geofences', authenticateToken, async (req, res) => {
  const { patient_id, name, center_lat, center_lng, radius } = req.body;

  try {
    const result = await pool.query(
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
    res.status(500).json({ error: '建立失敗' });
  }
});

// ==================== ALERTS & NOTIFICATIONS ====================

// Get alerts
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.name as patient_name
       FROM alerts a
       JOIN patients p ON a.patient_id = p.id
       WHERE p.guardian_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    res.json({
      success: true,
      alerts: result.rows
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: '查詢失敗' });
  }
});

// Send emergency alert
app.post('/api/alerts/emergency', authenticateToken, async (req, res) => {
  const { patient_id, message, location } = req.body;

  try {
    // Store alert
    const alert = await pool.query(
      `INSERT INTO alerts (patient_id, type, message, location, created_at)
       VALUES ($1, 'emergency', $2, $3, NOW())
       RETURNING *`,
      [patient_id, message, JSON.stringify(location)]
    );

    // Get guardian info
    const patient = await pool.query(
      `SELECT p.*, u.fcm_token
       FROM patients p
       JOIN users u ON p.guardian_id = u.id
       WHERE p.id = $1`,
      [patient_id]
    );

    if (patient.rows.length > 0 && patient.rows[0].fcm_token) {
      // Send push notification
      await admin.messaging().send({
        token: patient.rows[0].fcm_token,
        notification: {
          title: '緊急警報',
          body: message,
        },
        data: {
          type: 'emergency',
          patient_id: patient_id.toString(),
          alert_id: alert.rows[0].id.toString(),
        },
      });
    }

    res.json({
      success: true,
      alert: alert.rows[0]
    });
  } catch (error) {
    console.error('Send emergency alert error:', error);
    res.status(500).json({ error: '發送失敗' });
  }
});

// ==================== BLE BEACON TRACKING ====================

// Update beacon status
app.post('/api/beacons/status', authenticateToken, async (req, res) => {
  const { beacon_id, rssi, battery, last_seen } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO beacon_status (beacon_id, rssi, battery, last_seen)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (beacon_id)
       DO UPDATE SET rssi = $2, battery = $3, last_seen = $4
       RETURNING *`,
      [beacon_id, rssi, battery, last_seen || new Date()]
    );

    res.json({
      success: true,
      status: result.rows[0]
    });
  } catch (error) {
    console.error('Update beacon status error:', error);
    res.status(500).json({ error: '更新失敗' });
  }
});

// ==================== HELPER FUNCTIONS ====================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

async function sendGeofenceAlert(patient_id, geofence_id, lat, lng) {
  try {
    // Store alert
    await pool.query(
      `INSERT INTO alerts (patient_id, type, message, location, created_at)
       VALUES ($1, 'geofence', '患者已離開安全區域', $2, NOW())`,
      [patient_id, JSON.stringify({ lat, lng })]
    );

    // Get guardian FCM token
    const result = await pool.query(
      `SELECT u.fcm_token, p.name
       FROM patients p
       JOIN users u ON p.guardian_id = u.id
       WHERE p.id = $1`,
      [patient_id]
    );

    if (result.rows.length > 0 && result.rows[0].fcm_token) {
      await admin.messaging().send({
        token: result.rows[0].fcm_token,
        notification: {
          title: '離開安全區域警報',
          body: `${result.rows[0].name} 已離開指定的安全區域`,
        },
        data: {
          type: 'geofence_alert',
          patient_id: patient_id.toString(),
          lat: lat.toString(),
          lng: lng.toString(),
        },
      });
    }
  } catch (error) {
    console.error('Send geofence alert error:', error);
  }
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
    🚀 新竹安心守護後端服務啟動成功！

    📡 API Server: http://147.251.115.54:${PORT}
    🔌 WebSocket: ws://147.251.115.54:${PORT}

    Available endpoints:
    - POST /api/auth/register
    - POST /api/auth/login
    - GET  /api/patients
    - POST /api/locations
    - GET  /api/alerts
    - And more...
  `);
});

module.exports = app;