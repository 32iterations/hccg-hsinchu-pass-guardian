const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../services/database');

const JWT_SECRET = process.env.JWT_SECRET || 'hsinchu-guardian-secret-2025';

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Send emergency SOS
router.post('/sos', authenticateToken, async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      patient_id,
      message,
      battery_level,
      contact_ids = []
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    // Create emergency alert
    const alert = await db.createEmergencyAlert({
      user_id: req.user.userId,
      patient_id: patient_id || null,
      type: 'SOS',
      severity: 'critical',
      message: message || '緊急求救訊號已發送',
      location: {
        latitude,
        longitude,
        accuracy: req.body.accuracy || 10
      },
      battery_level,
      status: 'active',
      triggered_at: new Date()
    });

    // Get emergency contacts
    const emergencyContacts = patient_id
      ? await db.getPatientEmergencyContacts(patient_id)
      : await db.getUserEmergencyContacts(req.user.userId);

    // Send notifications to emergency contacts
    const notifications = [];
    for (const contact of emergencyContacts) {
      if (contact_ids.length === 0 || contact_ids.includes(contact.id)) {
        // Create notification for each contact
        const notification = await db.createNotification({
          user_id: contact.user_id || contact.id,
          type: 'emergency_sos',
          title: '緊急求救警報',
          message: `${req.user.name || '用戶'}發送了緊急求救訊號`,
          data: JSON.stringify({
            alert_id: alert.id,
            latitude,
            longitude,
            patient_id,
            sender_name: req.user.name
          }),
          is_read: false
        });
        notifications.push(notification);

        // Send SMS if phone number available (would integrate with SMS service)
        if (contact.phone) {
          console.log('Would send SMS to:', contact.phone);
        }

        // Send push notification if FCM token exists
        if (contact.fcm_token) {
          console.log('Would send push notification to:', contact.fcm_token);
        }
      }
    }

    // Log emergency event
    await db.logEvent({
      type: 'emergency_sos',
      user_id: req.user.userId,
      patient_id,
      description: 'Emergency SOS triggered',
      metadata: {
        location: { latitude, longitude },
        contacts_notified: emergencyContacts.length,
        battery_level
      }
    });

    res.json({
      success: true,
      alert,
      contacts_notified: emergencyContacts.length,
      message: '緊急求救訊號已成功發送'
    });
  } catch (error) {
    console.error('Emergency SOS error:', error);
    res.status(500).json({ error: 'Failed to send emergency SOS' });
  }
});

// Cancel emergency alert
router.post('/cancel/:alertId', authenticateToken, async (req, res) => {
  try {
    const alertId = parseInt(req.params.alertId);
    const { reason } = req.body;

    const alert = await db.getEmergencyAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to cancel this alert' });
    }

    // Update alert status
    await db.updateEmergencyAlert(alertId, {
      status: 'cancelled',
      cancelled_at: new Date(),
      cancel_reason: reason
    });

    // Notify emergency contacts about cancellation
    const emergencyContacts = alert.patient_id
      ? await db.getPatientEmergencyContacts(alert.patient_id)
      : await db.getUserEmergencyContacts(alert.user_id);

    for (const contact of emergencyContacts) {
      await db.createNotification({
        user_id: contact.user_id || contact.id,
        type: 'emergency_cancelled',
        title: '緊急警報已取消',
        message: `先前的緊急求救警報已被取消`,
        data: JSON.stringify({
          alert_id: alertId,
          cancel_reason: reason
        }),
        is_read: false
      });
    }

    res.json({
      success: true,
      message: 'Emergency alert cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel emergency error:', error);
    res.status(500).json({ error: 'Failed to cancel emergency alert' });
  }
});

// Get emergency alert status
router.get('/status/:alertId', authenticateToken, async (req, res) => {
  try {
    const alertId = parseInt(req.params.alertId);

    const alert = await db.getEmergencyAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to view this alert' });
    }

    res.json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Get alert status error:', error);
    res.status(500).json({ error: 'Failed to get alert status' });
  }
});

// Get emergency history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const alerts = await db.getUserEmergencyAlerts(req.user.userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: alerts.length
      }
    });
  } catch (error) {
    console.error('Get emergency history error:', error);
    res.status(500).json({ error: 'Failed to get emergency history' });
  }
});

// Add emergency contact
router.post('/contacts', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, relationship } = req.body;

    if (!name || (!phone && !email)) {
      return res.status(400).json({ error: 'Name and at least one contact method required' });
    }

    const contact = await db.addEmergencyContact({
      user_id: req.user.userId,
      name,
      phone,
      email,
      relationship
    });

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    console.error('Add emergency contact error:', error);
    res.status(500).json({ error: 'Failed to add emergency contact' });
  }
});

// Get emergency contacts
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const contacts = await db.getUserEmergencyContacts(req.user.userId);

    res.json({
      success: true,
      contacts
    });
  } catch (error) {
    console.error('Get emergency contacts error:', error);
    res.status(500).json({ error: 'Failed to get emergency contacts' });
  }
});

// Delete emergency contact
router.delete('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);

    const contact = await db.getEmergencyContactById(contactId);
    if (!contact || contact.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await db.deleteEmergencyContact(contactId);

    res.json({
      success: true,
      message: 'Emergency contact deleted'
    });
  } catch (error) {
    console.error('Delete emergency contact error:', error);
    res.status(500).json({ error: 'Failed to delete emergency contact' });
  }
});

module.exports = router;