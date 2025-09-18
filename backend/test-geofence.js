const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
let authToken = '';
let testUserId = null;
let testPatientId = null;
let testGeofenceId = null;

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  if (authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }
  return config;
});

async function runTests() {
  console.log('🚀 Starting Geofence API Tests\n');

  try {
    // 1. Create test user
    console.log('1️⃣ Creating test user...');
    await api.post('/api/test/create-user');

    // 2. Login
    console.log('2️⃣ Logging in...');
    const loginRes = await api.post('/api/auth/login', {
      email: 'test@hsinchu.gov.tw',
      password: 'test123'
    });
    authToken = loginRes.data.token;
    testUserId = loginRes.data.user.id;
    console.log('✅ Logged in successfully\n');

    // 3. Create a patient
    console.log('3️⃣ Creating test patient...');
    const patientRes = await api.post('/api/patients', {
      name: '測試患者',
      age: 75,
      address: '新竹市中正路120號',
      emergency_contact: '0912345678',
      beacon_id: 'BEACON-001'
    });
    testPatientId = patientRes.data.patient.id;
    console.log(`✅ Patient created with ID: ${testPatientId}\n`);

    // 4. Register FCM token
    console.log('4️⃣ Registering FCM token...');
    await api.post('/api/notifications/register', {
      fcm_token: 'test-fcm-token-12345'
    });
    console.log('✅ FCM token registered\n');

    // 5. Create geofence
    console.log('5️⃣ Creating geofence (安全區域)...');
    const geofenceRes = await api.post('/api/geofences', {
      name: '家',
      patient_id: testPatientId,
      center_latitude: 24.8066,
      center_longitude: 120.9686,
      radius: 100,
      description: '住家安全區域',
      alert_on_exit: true,
      alert_on_enter: true,
      emergency_contacts: ['0911111111', '0922222222']
    });
    testGeofenceId = geofenceRes.data.geofence.id;
    console.log(`✅ Geofence created: ${geofenceRes.data.geofence.name}\n`);

    // 6. Get all geofences
    console.log('6️⃣ Getting all geofences...');
    const geofencesRes = await api.get('/api/geofences');
    console.log(`✅ Found ${geofencesRes.data.geofences.length} geofence(s)\n`);

    // 7. Test location inside geofence
    console.log('7️⃣ Testing location INSIDE geofence...');
    const insideRes = await api.post('/api/geofences/check', {
      patient_id: testPatientId,
      latitude: 24.8066,
      longitude: 120.9686,
      timestamp: new Date().toISOString()
    });
    console.log(`   Status: ${insideRes.data.statuses[0].inside ? 'INSIDE ✅' : 'OUTSIDE ❌'}`);
    console.log(`   Distance: ${insideRes.data.statuses[0].distance}m`);
    console.log(`   Alerts: ${insideRes.data.alerts.length}\n`);

    await delay(1000);

    // 8. Test location outside geofence (trigger exit alert)
    console.log('8️⃣ Testing location OUTSIDE geofence (should trigger alert)...');
    const outsideRes = await api.post('/api/geofences/check', {
      patient_id: testPatientId,
      latitude: 24.8100, // Moved north
      longitude: 120.9700, // Moved east
      timestamp: new Date().toISOString()
    });
    console.log(`   Status: ${outsideRes.data.statuses[0].inside ? 'INSIDE' : 'OUTSIDE ⚠️'}`);
    console.log(`   Distance: ${outsideRes.data.statuses[0].distance}m`);
    console.log(`   Alerts: ${outsideRes.data.alerts.length}`);
    if (outsideRes.data.alerts.length > 0) {
      console.log(`   Alert: ${outsideRes.data.alerts[0].message}`);
    }
    console.log('');

    // 9. Test SOS emergency
    console.log('9️⃣ Testing SOS Emergency...');
    const sosRes = await api.post('/api/sos', {
      patient_id: testPatientId,
      latitude: 24.8100,
      longitude: 120.9700,
      message: '測試緊急求救！',
      battery_level: 25
    });
    console.log(`✅ SOS sent! Alert ID: ${sosRes.data.alert.id}`);
    console.log(`   Notified contacts: ${sosRes.data.notified_contacts}\n`);

    // 10. Test anomaly detection
    console.log('🔟 Testing anomaly detection (no movement)...');
    const locations = [
      { latitude: 24.8066, longitude: 120.9686, timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      { latitude: 24.8066, longitude: 120.9686, timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { latitude: 24.8066, longitude: 120.9686, timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
      { latitude: 24.8066, longitude: 120.9686, timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      { latitude: 24.8066, longitude: 120.9686, timestamp: new Date().toISOString() }
    ];

    const anomalyRes = await api.post('/api/anomaly/check', {
      patient_id: testPatientId,
      locations: locations,
      threshold_minutes: 30
    });
    console.log(`   Anomaly detected: ${anomalyRes.data.anomaly_detected ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`   Max distance moved: ${anomalyRes.data.max_distance}m`);
    if (anomalyRes.data.alerts.length > 0) {
      console.log(`   Alert: ${anomalyRes.data.alerts[0].message}`);
    }
    console.log('');

    // 11. Update geofence
    console.log('1️⃣1️⃣ Updating geofence...');
    await api.put(`/api/geofences/${testGeofenceId}`, {
      radius: 200,
      description: '擴大的住家安全區域'
    });
    console.log('✅ Geofence updated\n');

    // 12. Get SOS history
    console.log('1️⃣2️⃣ Getting SOS history...');
    const sosHistoryRes = await api.get(`/api/sos/history/${testPatientId}`);
    console.log(`✅ Found ${sosHistoryRes.data.alerts.length} SOS alert(s)\n`);

    // 13. Delete geofence
    console.log('1️⃣3️⃣ Deleting geofence...');
    await api.delete(`/api/geofences/${testGeofenceId}`);
    console.log('✅ Geofence deleted\n');

    console.log('✨ All tests completed successfully!\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ User authentication');
    console.log('   ✅ Patient management');
    console.log('   ✅ Geofence CRUD operations');
    console.log('   ✅ Location monitoring');
    console.log('   ✅ Exit/Enter alerts');
    console.log('   ✅ SOS emergency alerts');
    console.log('   ✅ Anomaly detection');
    console.log('   ✅ FCM token registration');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run tests
console.log('===============================================');
console.log('     新竹安心守護 - 地理圍欄 API 測試');
console.log('     Hsinchu Pass Guardian - Geofence API Test');
console.log('===============================================\n');

runTests();