const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    // Load service account credentials
    const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
    const serviceAccount = require(serviceAccountPath);

    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'hccg-hsinchu-pass-guardian',
    });

    console.log('🔥 Firebase Admin SDK initialized successfully');
    firebaseInitialized = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    console.log('📝 Running in mock mode - notifications will be logged only');
  }
}

// Token storage (in production, use database)
const userTokens = new Map();

/**
 * Register or update FCM token for a user
 */
async function registerToken(userId, fcmToken) {
  userTokens.set(userId, fcmToken);
  console.log(`Registered FCM token for user ${userId}`);
  return true;
}

/**
 * Send push notification to a user
 */
async function sendNotificationToUser(userId, notification) {
  const token = userTokens.get(userId);

  if (!token) {
    console.log(`No FCM token found for user ${userId}`);
    return false;
  }

  return sendNotification(token, notification);
}

/**
 * Send push notification to a specific token
 */
async function sendNotification(token, notification) {
  if (!firebaseInitialized) {
    console.log('Firebase not initialized, skipping notification');
    return false;
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      token: token,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
          visibility: 'public',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    if (firebaseInitialized && admin.apps.length > 0) {
      // Actually send the notification
      const response = await admin.messaging().send(message);
      console.log('✅ Successfully sent notification:', response);
      return true;
    } else {
      // Mock response for testing when Firebase not available
      console.log('📱 Mock notification sent:', {
        to: token.substring(0, 10) + '...',
        title: notification.title,
        body: notification.body,
      });
    }

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Send geofence alert notification
 */
async function sendGeofenceAlert(userId, geofenceData) {
  const notification = {
    title: geofenceData.type === 'EXIT_GEOFENCE'
      ? '⚠️ 離開安全區域警報'
      : '✅ 進入安全區域',
    body: geofenceData.message,
    data: {
      type: 'GEOFENCE_ALERT',
      geofence_id: String(geofenceData.geofence_id),
      patient_id: String(geofenceData.patient_id),
      timestamp: new Date().toISOString(),
    },
  };

  return sendNotificationToUser(userId, notification);
}

/**
 * Send SOS emergency notification
 */
async function sendSOSAlert(userId, sosData) {
  const notification = {
    title: '🚨 緊急求救警報',
    body: sosData.message,
    data: {
      type: 'SOS_EMERGENCY',
      patient_id: String(sosData.patient_id),
      latitude: String(sosData.location.latitude),
      longitude: String(sosData.location.longitude),
      timestamp: new Date().toISOString(),
    },
  };

  return sendNotificationToUser(userId, notification);
}

/**
 * Send anomaly detection notification
 */
async function sendAnomalyAlert(userId, anomalyData) {
  const notification = {
    title: '⚠️ 異常偵測警報',
    body: anomalyData.message,
    data: {
      type: 'ANOMALY_DETECTED',
      patient_id: String(anomalyData.patient_id),
      duration_minutes: String(anomalyData.duration_minutes),
      timestamp: new Date().toISOString(),
    },
  };

  return sendNotificationToUser(userId, notification);
}

/**
 * Send notification to multiple users
 */
async function sendMulticast(tokens, notification) {
  if (!firebaseInitialized || tokens.length === 0) {
    return { success: 0, failed: tokens.length };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };

    if (firebaseInitialized && admin.apps.length > 0) {
      // Actually send multicast notification
      const response = await admin.messaging().sendMulticast(message);
      console.log(`✅ Multicast sent: ${response.successCount} success, ${response.failureCount} failed`);
      return {
        success: response.successCount,
        failed: response.failureCount,
      };
    } else {
      // Mock response
      console.log(`📱 Mock multicast sent to ${tokens.length} recipients`);
      return { success: tokens.length, failed: 0 };
    }
  } catch (error) {
    console.error('Error sending multicast:', error);
    return { success: 0, failed: tokens.length };
  }
}

// Initialize on module load
initializeFirebase();

module.exports = {
  registerToken,
  sendNotificationToUser,
  sendNotification,
  sendGeofenceAlert,
  sendSOSAlert,
  sendAnomalyAlert,
  sendMulticast,
};