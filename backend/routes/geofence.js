const express = require('express');
const router = express.Router();
const notificationService = require('../services/firebase-notification');
const db = require('../services/database');

// In-memory storage for temporary data
const sosAlerts = [];
const geofenceStatus = new Map(); // Track patient status in geofences

// ==================== GEOFENCE MANAGEMENT ====================

// Create a new geofence (safe zone)
router.post('/geofences', (req, res) => {
  const {
    name,
    patient_id,
    center_latitude,
    center_longitude,
    radius,
    description,
    alert_on_exit,
    alert_on_enter,
    emergency_contacts
  } = req.body;

  // Validate required fields
  if (!name || !patient_id || !center_latitude || !center_longitude || !radius) {
    return res.status(400).json({
      error: '必填欄位缺失: name, patient_id, center_latitude, center_longitude, radius'
    });
  }

  const geofence = {
    id: geofences.length + 1,
    name,
    patient_id,
    guardian_id: req.user.id,
    center: {
      latitude: parseFloat(center_latitude),
      longitude: parseFloat(center_longitude)
    },
    radius: parseFloat(radius), // in meters
    description: description || '',
    alert_on_exit: alert_on_exit !== false, // default true
    alert_on_enter: alert_on_enter !== false, // default true
    emergency_contacts: emergency_contacts || [],
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  geofences.push(geofence);

  // Initialize geofence status for patient
  if (!geofenceStatus.has(patient_id)) {
    geofenceStatus.set(patient_id, new Map());
  }
  geofenceStatus.get(patient_id).set(geofence.id, {
    inside: false,
    last_event: null,
    last_check: new Date()
  });

  res.json({
    success: true,
    geofence
  });
});

// Get all geofences for a user
router.get('/geofences', async (req, res) => {
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

// Get geofences for a specific patient
router.get('/geofences/patient/:patientId', (req, res) => {
  const { patientId } = req.params;

  const patientGeofences = geofences.filter(g =>
    g.patient_id === parseInt(patientId) &&
    g.guardian_id === req.user.id &&
    g.active
  );

  res.json({
    success: true,
    geofences: patientGeofences
  });
});

// Update a geofence
router.put('/geofences/:id', (req, res) => {
  const { id } = req.params;
  const geofenceIndex = geofences.findIndex(g =>
    g.id === parseInt(id) && g.guardian_id === req.user.id
  );

  if (geofenceIndex === -1) {
    return res.status(404).json({ error: '找不到地理圍欄' });
  }

  const updates = req.body;
  const geofence = geofences[geofenceIndex];

  // Update allowed fields
  const allowedFields = [
    'name', 'description', 'radius',
    'alert_on_exit', 'alert_on_enter', 'emergency_contacts'
  ];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      geofence[field] = updates[field];
    }
  });

  geofence.updated_at = new Date();
  geofences[geofenceIndex] = geofence;

  res.json({
    success: true,
    geofence
  });
});

// Delete (deactivate) a geofence
router.delete('/geofences/:id', (req, res) => {
  const { id } = req.params;
  const geofence = geofences.find(g =>
    g.id === parseInt(id) && g.guardian_id === req.user.id
  );

  if (!geofence) {
    return res.status(404).json({ error: '找不到地理圍欄' });
  }

  geofence.active = false;
  geofence.updated_at = new Date();

  res.json({
    success: true,
    message: '地理圍欄已停用'
  });
});

// ==================== LOCATION MONITORING ====================

// Check location against geofences and trigger alerts
router.post('/geofences/check', async (req, res) => {
  const { patient_id, latitude, longitude, timestamp } = req.body;

  if (!patient_id || !latitude || !longitude) {
    return res.status(400).json({
      error: '必填欄位缺失: patient_id, latitude, longitude'
    });
  }

  const patientGeofences = geofences.filter(g =>
    g.patient_id === patient_id && g.active
  );

  const alerts = [];
  const statuses = [];

  for (const geofence of patientGeofences) {
    const distance = calculateDistance(
      latitude,
      longitude,
      geofence.center.latitude,
      geofence.center.longitude
    );

    const isInside = distance <= geofence.radius;

    // Get previous status
    const patientStatus = geofenceStatus.get(patient_id);
    const previousStatus = patientStatus?.get(geofence.id);
    const wasInside = previousStatus?.inside || false;

    // Update status
    if (patientStatus) {
      patientStatus.set(geofence.id, {
        inside: isInside,
        last_event: isInside !== wasInside ? new Date() : previousStatus.last_event,
        last_check: new Date(),
        distance: Math.round(distance)
      });
    }

    // Check for status change
    if (wasInside && !isInside && geofence.alert_on_exit) {
      // Patient left the safe zone
      const alert = {
        type: 'EXIT_GEOFENCE',
        geofence_id: geofence.id,
        geofence_name: geofence.name,
        patient_id,
        location: { latitude, longitude },
        distance: Math.round(distance),
        timestamp: new Date(),
        message: `警報：患者已離開安全區域「${geofence.name}」！距離: ${Math.round(distance)}公尺`
      };

      alerts.push(alert);

      // Send push notification if FCM token exists
      await sendPushNotification(geofence.guardian_id, alert);

      // Notify emergency contacts
      await notifyEmergencyContacts(geofence.emergency_contacts, alert);
    } else if (!wasInside && isInside && geofence.alert_on_enter) {
      // Patient entered the safe zone
      const alert = {
        type: 'ENTER_GEOFENCE',
        geofence_id: geofence.id,
        geofence_name: geofence.name,
        patient_id,
        location: { latitude, longitude },
        timestamp: new Date(),
        message: `通知：患者已進入安全區域「${geofence.name}」`
      };

      alerts.push(alert);
      await sendPushNotification(geofence.guardian_id, alert);
    }

    statuses.push({
      geofence_id: geofence.id,
      geofence_name: geofence.name,
      inside: isInside,
      distance: Math.round(distance),
      radius: geofence.radius
    });
  }

  res.json({
    success: true,
    statuses,
    alerts
  });
});

// ==================== SOS EMERGENCY ====================

// Trigger SOS emergency alert
router.post('/sos', async (req, res) => {
  const {
    patient_id,
    latitude,
    longitude,
    message,
    battery_level
  } = req.body;

  if (!patient_id || !latitude || !longitude) {
    return res.status(400).json({
      error: '必填欄位缺失: patient_id, latitude, longitude'
    });
  }

  const sosAlert = {
    id: sosAlerts.length + 1,
    patient_id,
    guardian_id: req.user.id,
    location: { latitude, longitude },
    message: message || '緊急求救！請立即協助！',
    battery_level,
    timestamp: new Date(),
    acknowledged: false
  };

  sosAlerts.push(sosAlert);

  // Send immediate push notification
  const notification = {
    type: 'SOS_EMERGENCY',
    patient_id,
    location: { latitude, longitude },
    message: `🚨 緊急求救 🚨\n${sosAlert.message}\n位置: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    timestamp: new Date()
  };

  await sendPushNotification(req.user.id, notification);

  // Get all emergency contacts for this patient
  const patientGeofences = geofences.filter(g =>
    g.patient_id === patient_id && g.active
  );

  const allContacts = new Set();
  patientGeofences.forEach(g => {
    if (g.emergency_contacts) {
      g.emergency_contacts.forEach(contact => allContacts.add(contact));
    }
  });

  await notifyEmergencyContacts(Array.from(allContacts), notification);

  res.json({
    success: true,
    alert: sosAlert,
    notified_contacts: Array.from(allContacts).length
  });
});

// Get SOS alert history
router.get('/sos/history/:patientId', (req, res) => {
  const { patientId } = req.params;

  const patientAlerts = sosAlerts.filter(alert =>
    alert.patient_id === parseInt(patientId) &&
    alert.guardian_id === req.user.id
  ).sort((a, b) => b.timestamp - a.timestamp);

  res.json({
    success: true,
    alerts: patientAlerts
  });
});

// Acknowledge SOS alert
router.post('/sos/:id/acknowledge', (req, res) => {
  const { id } = req.params;
  const alert = sosAlerts.find(a =>
    a.id === parseInt(id) && a.guardian_id === req.user.id
  );

  if (!alert) {
    return res.status(404).json({ error: '找不到緊急警報' });
  }

  alert.acknowledged = true;
  alert.acknowledged_at = new Date();
  alert.acknowledged_by = req.user.id;

  res.json({
    success: true,
    alert
  });
});

// ==================== ANOMALY DETECTION ====================

// Check for anomalies (no movement for extended period)
router.post('/anomaly/check', async (req, res) => {
  const {
    patient_id,
    locations, // Array of recent locations with timestamps
    threshold_minutes = 30 // Default 30 minutes
  } = req.body;

  if (!patient_id || !locations || !Array.isArray(locations)) {
    return res.status(400).json({
      error: '必填欄位缺失: patient_id, locations (array)'
    });
  }

  const alerts = [];

  // Sort locations by timestamp
  const sortedLocations = locations.sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  if (sortedLocations.length < 2) {
    return res.json({
      success: true,
      anomaly_detected: false,
      message: '資料不足以進行異常檢測'
    });
  }

  // Check for lack of movement
  const latestLocation = sortedLocations[0];
  const thresholdTime = new Date(Date.now() - threshold_minutes * 60 * 1000);

  let hasMovement = false;
  let maxDistance = 0;

  for (let i = 1; i < sortedLocations.length; i++) {
    const loc = sortedLocations[i];
    if (new Date(loc.timestamp) < thresholdTime) break;

    const distance = calculateDistance(
      latestLocation.latitude,
      latestLocation.longitude,
      loc.latitude,
      loc.longitude
    );

    maxDistance = Math.max(maxDistance, distance);

    // Consider movement if distance > 10 meters
    if (distance > 10) {
      hasMovement = true;
      break;
    }
  }

  if (!hasMovement) {
    const alert = {
      type: 'NO_MOVEMENT_DETECTED',
      patient_id,
      location: latestLocation,
      duration_minutes: threshold_minutes,
      max_distance: Math.round(maxDistance),
      timestamp: new Date(),
      message: `⚠️ 異常偵測：患者已${threshold_minutes}分鐘沒有明顯移動`
    };

    alerts.push(alert);
    await sendPushNotification(req.user.id, alert);
  }

  res.json({
    success: true,
    anomaly_detected: !hasMovement,
    max_distance: Math.round(maxDistance),
    alerts
  });
});

// ==================== HELPER FUNCTIONS ====================

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Send push notification via Firebase
async function sendPushNotification(userId, alert) {
  try {
    console.log(`Sending push notification to user ${userId}:`, alert.message);

    // Use appropriate notification service method based on alert type
    if (alert.type === 'SOS_EMERGENCY') {
      return await notificationService.sendSOSAlert(userId, alert);
    } else if (alert.type === 'EXIT_GEOFENCE' || alert.type === 'ENTER_GEOFENCE') {
      return await notificationService.sendGeofenceAlert(userId, alert);
    } else if (alert.type === 'NO_MOVEMENT_DETECTED') {
      return await notificationService.sendAnomalyAlert(userId, alert);
    } else {
      // Generic notification
      return await notificationService.sendNotificationToUser(userId, {
        title: '⚠️ 安全警報',
        body: alert.message,
        data: {
          type: alert.type,
          patient_id: String(alert.patient_id),
          timestamp: alert.timestamp.toISOString()
        }
      });
    }
  } catch (error) {
    console.error('Push notification error:', error);
    return false;
  }
}

// Notify emergency contacts
async function notifyEmergencyContacts(contacts, alert) {
  try {
    // In a real implementation, send SMS/email to emergency contacts
    console.log(`Notifying ${contacts.length} emergency contacts:`, alert.message);

    // Example: Send SMS via Twilio or email via SendGrid

    return true;
  } catch (error) {
    console.error('Emergency contact notification error:', error);
    return false;
  }
}

module.exports = router;