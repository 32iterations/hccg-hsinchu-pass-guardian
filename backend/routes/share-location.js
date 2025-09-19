const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

// Create location sharing session
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const {
      duration_minutes = 60,
      recipients = [],
      patient_id,
      message,
      allow_tracking = true
    } = req.body;

    // Generate unique share code
    const shareCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    const shareUrl = `http://147.251.115.54:3001/track/${shareCode}`;

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + duration_minutes * 60 * 1000);

    // Create sharing session
    const session = await db.createLocationShareSession({
      user_id: req.user.userId,
      patient_id,
      share_code: shareCode,
      share_url: shareUrl,
      expires_at: expiresAt,
      is_active: true,
      allow_tracking,
      message,
      created_at: new Date()
    });

    // Send notifications to recipients
    if (recipients.length > 0) {
      for (const recipient of recipients) {
        if (recipient.email) {
          // Send email notification (would integrate with email service)
          console.log('Would send email to:', recipient.email, 'with URL:', shareUrl);
        }

        if (recipient.phone) {
          // Send SMS notification (would integrate with SMS service)
          console.log('Would send SMS to:', recipient.phone, 'with URL:', shareUrl);
        }

        if (recipient.user_id) {
          // Create in-app notification
          await db.createNotification({
            user_id: recipient.user_id,
            type: 'location_share',
            title: '位置分享邀請',
            message: `${req.user.name || '用戶'}與您分享了即時位置`,
            data: JSON.stringify({
              session_id: session.id,
              share_url: shareUrl,
              expires_at: expiresAt,
              sender_name: req.user.name
            }),
            is_read: false
          });
        }
      }
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        share_code: shareCode,
        share_url: shareUrl,
        expires_at: expiresAt,
        duration_minutes
      },
      message: '位置分享連結已創建'
    });
  } catch (error) {
    console.error('Create share session error:', error);
    res.status(500).json({ error: 'Failed to create sharing session' });
  }
});

// Get shared location by code (public endpoint)
router.get('/track/:shareCode', async (req, res) => {
  try {
    const { shareCode } = req.params;

    const session = await db.getLocationShareSessionByCode(shareCode);
    if (!session) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    if (!session.is_active) {
      return res.status(410).json({ error: 'Share link has been deactivated' });
    }

    // Get latest location
    const location = session.patient_id
      ? await db.getLatestPatientLocation(session.patient_id)
      : await db.getLatestUserLocation(session.user_id);

    if (!location) {
      return res.status(404).json({ error: 'No location data available' });
    }

    // Log access
    await db.logLocationShareAccess({
      session_id: session.id,
      accessed_at: new Date(),
      ip_address: req.ip
    });

    res.json({
      success: true,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        updated_at: location.timestamp || location.created_at,
        battery_level: location.battery_level
      },
      session: {
        message: session.message,
        expires_at: session.expires_at,
        allow_tracking: session.allow_tracking
      }
    });
  } catch (error) {
    console.error('Track location error:', error);
    res.status(500).json({ error: 'Failed to get shared location' });
  }
});

// Update location for active share session
router.post('/update', authenticateToken, async (req, res) => {
  try {
    const {
      session_id,
      latitude,
      longitude,
      accuracy,
      battery_level
    } = req.body;

    const session = await db.getLocationShareSessionById(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to update this session' });
    }

    // Check if session is still active
    if (!session.is_active || new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share session has ended' });
    }

    // Update location
    await db.updateLocation({
      user_id: req.user.userId,
      patient_id: session.patient_id,
      latitude,
      longitude,
      accuracy,
      battery_level
    });

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Update share location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Stop sharing session
router.post('/stop/:sessionId', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);

    const session = await db.getLocationShareSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to stop this session' });
    }

    // Deactivate session
    await db.updateLocationShareSession(sessionId, {
      is_active: false,
      stopped_at: new Date()
    });

    res.json({
      success: true,
      message: 'Location sharing stopped'
    });
  } catch (error) {
    console.error('Stop share session error:', error);
    res.status(500).json({ error: 'Failed to stop sharing session' });
  }
});

// Get active sharing sessions
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const sessions = await db.getUserActiveShareSessions(req.user.userId);

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        share_code: s.share_code,
        share_url: s.share_url,
        expires_at: s.expires_at,
        is_active: s.is_active,
        patient_id: s.patient_id,
        created_at: s.created_at
      }))
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
});

// Get sharing history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const sessions = await db.getUserShareHistory(req.user.userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: sessions.length
      }
    });
  } catch (error) {
    console.error('Get share history error:', error);
    res.status(500).json({ error: 'Failed to get sharing history' });
  }
});

// Extend sharing session
router.post('/extend/:sessionId', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const { additional_minutes = 30 } = req.body;

    const session = await db.getLocationShareSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to extend this session' });
    }

    // Calculate new expiry time
    const currentExpiry = new Date(session.expires_at);
    const newExpiry = new Date(Math.max(
      Date.now(),
      currentExpiry.getTime()
    ) + additional_minutes * 60 * 1000);

    // Update session
    await db.updateLocationShareSession(sessionId, {
      expires_at: newExpiry
    });

    res.json({
      success: true,
      new_expiry: newExpiry,
      message: `分享時間已延長 ${additional_minutes} 分鐘`
    });
  } catch (error) {
    console.error('Extend share session error:', error);
    res.status(500).json({ error: 'Failed to extend sharing session' });
  }
});

module.exports = router;