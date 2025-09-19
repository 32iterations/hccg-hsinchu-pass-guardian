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

// Get notifications for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    const notifications = await db.getUserNotifications(req.user.userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unread_only === 'true'
    });

    const unreadCount = await db.getUnreadNotificationCount(req.user.userId);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    const notification = await db.getNotificationById(notificationId);
    if (!notification || notification.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.markNotificationAsRead(notificationId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.markAllNotificationsAsRead(req.user.userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    const notification = await db.getNotificationById(notificationId);
    if (!notification || notification.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.deleteNotification(notificationId);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Create notification (internal use)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { user_id, type, title, message, data } = req.body;

    // Only allow admins to create notifications for other users
    if (req.user.role !== 'admin' && user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to create notifications for other users' });
    }

    const notification = await db.createNotification({
      user_id,
      type,
      title,
      message,
      data: JSON.stringify(data || {}),
      is_read: false
    });

    // Send push notification if FCM token exists
    const user = await db.getUserById(user_id);
    if (user && user.fcm_token) {
      // This would integrate with Firebase Admin SDK
      console.log('Would send push notification to:', user.fcm_token);
    }

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;