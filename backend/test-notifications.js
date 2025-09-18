#!/usr/bin/env node

/**
 * Test script for Firebase Push Notifications
 * Tests notification service functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

let authToken = '';
let userId = '';

async function createTestUser() {
  console.log('🔧 Creating test user...');

  try {
    const response = await axios.post(`${BASE_URL}/api/test/create-user`);
    console.log('✅ Test user created:', response.data);
    return response.data.credentials;
  } catch (error) {
    console.error('❌ Failed to create test user:', error.response?.data || error.message);
    throw error;
  }
}

async function loginUser(credentials) {
  console.log('🔐 Logging in...');

  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, credentials);
    console.log('✅ Login successful');

    authToken = response.data.token;
    userId = response.data.user.id;

    return response.data;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function registerFCMToken() {
  console.log('📱 Registering FCM token...');

  const testToken = 'test-fcm-token-' + Math.random().toString(36).substr(2, 9);

  try {
    const response = await axios.post(
      `${BASE_URL}/api/notifications/register`,
      { fcm_token: testToken },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ FCM token registered:', response.data);
    return testToken;
  } catch (error) {
    console.error('❌ FCM registration failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testNotificationService() {
  console.log('🔥 Testing Firebase notification service...');

  try {
    // Import the notification service
    const notificationService = require('./services/firebase-notification');

    // Test geofence alert
    console.log('📍 Testing geofence alert...');
    const geofenceResult = await notificationService.sendGeofenceAlert(userId, {
      type: 'EXIT_GEOFENCE',
      message: '患者已離開安全區域 - 新竹火車站',
      geofence_id: 1,
      patient_id: 1
    });
    console.log('Geofence alert result:', geofenceResult);

    // Test SOS alert
    console.log('🚨 Testing SOS alert...');
    const sosResult = await notificationService.sendSOSAlert(userId, {
      message: '緊急求救！患者需要立即協助',
      patient_id: 1,
      location: {
        latitude: 24.8047,
        longitude: 120.9714
      }
    });
    console.log('SOS alert result:', sosResult);

    // Test anomaly alert
    console.log('⚠️ Testing anomaly alert...');
    const anomalyResult = await notificationService.sendAnomalyAlert(userId, {
      message: '偵測到異常行為模式',
      patient_id: 1,
      duration_minutes: 30
    });
    console.log('Anomaly alert result:', anomalyResult);

    return true;
  } catch (error) {
    console.error('❌ Notification service test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Firebase Push Notification Tests\n');

  try {
    // 1. Create test user
    const credentials = await createTestUser();

    // 2. Login
    await loginUser(credentials);

    // 3. Register FCM token
    const fcmToken = await registerFCMToken();

    // 4. Test notification service
    const notificationTestResult = await testNotificationService();

    console.log('\n📊 Test Results Summary:');
    console.log('✅ User creation: PASSED');
    console.log('✅ User login: PASSED');
    console.log('✅ FCM registration: PASSED');
    console.log(`${notificationTestResult ? '✅' : '❌'} Notification service: ${notificationTestResult ? 'PASSED' : 'FAILED'}`);

    if (notificationTestResult) {
      console.log('\n🎉 All tests PASSED! Firebase push notifications are working.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the logs above for details.');
    }

  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();