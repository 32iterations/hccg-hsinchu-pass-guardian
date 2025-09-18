const db = require('../services/database');
const bcrypt = require('bcryptjs');

describe('Database Service Tests', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await db.query('TRUNCATE TABLE locations, alerts, geofences, patients, users RESTART IDENTITY CASCADE');
  });

  describe('User Operations', () => {
    test('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const user = await db.createUser(userData);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user).toHaveProperty('created_at');
    });

    test('should get user by email', async () => {
      const userData = {
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const createdUser = await db.createUser(userData);
      const foundUser = await db.getUserByEmail(userData.email);

      expect(foundUser).toBeTruthy();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    test('should get user by id', async () => {
      const userData = {
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const createdUser = await db.createUser(userData);
      const foundUser = await db.getUserById(createdUser.id);

      expect(foundUser).toBeTruthy();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    test('should update user FCM token', async () => {
      const userData = {
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '測試用戶',
        role: 'family',
        phone: '0912345678'
      };

      const user = await db.createUser(userData);
      const fcmToken = 'test-fcm-token-123';

      await db.updateUserFCMToken(user.id, fcmToken);

      const updatedUser = await db.getUserById(user.id);
      expect(updatedUser.fcm_token).toBe(fcmToken);
    });
  });

  describe('Patient Operations', () => {
    let guardianUser;

    beforeEach(async () => {
      const userData = {
        email: 'guardian@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '監護人',
        role: 'family',
        phone: '0912345678'
      };
      guardianUser = await db.createUser(userData);
    });

    test('should create a new patient', async () => {
      const patientData = {
        name: '患者姓名',
        age: 75,
        address: '新竹市東區',
        guardian_id: guardianUser.id,
        emergency_contact: '0987654321',
        beacon_id: 'beacon-001'
      };

      const patient = await db.createPatient(patientData);

      expect(patient).toHaveProperty('id');
      expect(patient.name).toBe(patientData.name);
      expect(patient.age).toBe(patientData.age);
      expect(patient.guardian_id).toBe(guardianUser.id);
      expect(patient.beacon_id).toBe(patientData.beacon_id);
    });

    test('should get patients by guardian id', async () => {
      const patientData1 = {
        name: '患者一',
        age: 75,
        address: '新竹市東區',
        guardian_id: guardianUser.id,
        emergency_contact: '0987654321',
        beacon_id: 'beacon-001'
      };

      const patientData2 = {
        name: '患者二',
        age: 80,
        address: '新竹市西區',
        guardian_id: guardianUser.id,
        emergency_contact: '0987654322',
        beacon_id: 'beacon-002'
      };

      await db.createPatient(patientData1);
      await db.createPatient(patientData2);

      const patients = await db.getPatientsByGuardianId(guardianUser.id);

      expect(patients).toHaveLength(2);
      expect(patients[0].name).toBe(patientData2.name); // Should be ordered by created_at DESC
      expect(patients[1].name).toBe(patientData1.name);
    });
  });

  describe('Location Operations', () => {
    let patient;

    beforeEach(async () => {
      const userData = {
        email: 'guardian@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '監護人',
        role: 'family',
        phone: '0912345678'
      };
      const guardianUser = await db.createUser(userData);

      const patientData = {
        name: '患者姓名',
        age: 75,
        address: '新竹市東區',
        guardian_id: guardianUser.id,
        emergency_contact: '0987654321',
        beacon_id: 'beacon-001'
      };
      patient = await db.createPatient(patientData);
    });

    test('should create a new location', async () => {
      const locationData = {
        patient_id: patient.id,
        latitude: 24.8047,
        longitude: 120.9714,
        accuracy: 5.0,
        battery_level: 85
      };

      const location = await db.createLocation(locationData);

      expect(location).toHaveProperty('id');
      expect(location.patient_id).toBe(patient.id);
      expect(parseFloat(location.latitude)).toBe(locationData.latitude);
      expect(parseFloat(location.longitude)).toBe(locationData.longitude);
      expect(location.battery_level).toBe(locationData.battery_level);
      expect(location).toHaveProperty('timestamp');
    });

    test('should get location history', async () => {
      const locationData1 = {
        patient_id: patient.id,
        latitude: 24.8047,
        longitude: 120.9714,
        accuracy: 5.0,
        battery_level: 85
      };

      const locationData2 = {
        patient_id: patient.id,
        latitude: 24.8048,
        longitude: 120.9715,
        accuracy: 6.0,
        battery_level: 84
      };

      await db.createLocation(locationData1);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await db.createLocation(locationData2);

      const history = await db.getLocationHistory(patient.id, 10);

      expect(history).toHaveLength(2);
      expect(parseFloat(history[0].latitude)).toBe(locationData2.latitude); // Latest first
      expect(parseFloat(history[1].latitude)).toBe(locationData1.latitude);
    });

    test('should get latest location', async () => {
      const locationData1 = {
        patient_id: patient.id,
        latitude: 24.8047,
        longitude: 120.9714,
        accuracy: 5.0,
        battery_level: 85
      };

      const locationData2 = {
        patient_id: patient.id,
        latitude: 24.8048,
        longitude: 120.9715,
        accuracy: 6.0,
        battery_level: 84
      };

      await db.createLocation(locationData1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await db.createLocation(locationData2);

      const latestLocation = await db.getLatestLocation(patient.id);

      expect(latestLocation).toBeTruthy();
      expect(parseFloat(latestLocation.latitude)).toBe(locationData2.latitude);
      expect(parseFloat(latestLocation.longitude)).toBe(locationData2.longitude);
    });
  });

  describe('Geofence Operations', () => {
    let patient;

    beforeEach(async () => {
      const userData = {
        email: 'guardian@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '監護人',
        role: 'family',
        phone: '0912345678'
      };
      const guardianUser = await db.createUser(userData);

      const patientData = {
        name: '患者姓名',
        age: 75,
        address: '新竹市東區',
        guardian_id: guardianUser.id,
        emergency_contact: '0987654321',
        beacon_id: 'beacon-001'
      };
      patient = await db.createPatient(patientData);
    });

    test('should create a new geofence', async () => {
      const geofenceData = {
        patient_id: patient.id,
        name: '家附近',
        center_lat: 24.8047,
        center_lng: 120.9714,
        radius: 500
      };

      const geofence = await db.createGeofence(geofenceData);

      expect(geofence).toHaveProperty('id');
      expect(geofence.patient_id).toBe(patient.id);
      expect(geofence.name).toBe(geofenceData.name);
      expect(parseFloat(geofence.center_lat)).toBe(geofenceData.center_lat);
      expect(parseFloat(geofence.center_lng)).toBe(geofenceData.center_lng);
      expect(geofence.radius).toBe(geofenceData.radius);
      expect(geofence.is_active).toBe(true);
    });

    test('should get geofences by patient id', async () => {
      const geofenceData1 = {
        patient_id: patient.id,
        name: '家附近',
        center_lat: 24.8047,
        center_lng: 120.9714,
        radius: 500
      };

      const geofenceData2 = {
        patient_id: patient.id,
        name: '醫院附近',
        center_lat: 24.8100,
        center_lng: 120.9800,
        radius: 300
      };

      await db.createGeofence(geofenceData1);
      await db.createGeofence(geofenceData2);

      const geofences = await db.getGeofencesByPatientId(patient.id);

      expect(geofences).toHaveLength(2);
    });
  });

  describe('Alert Operations', () => {
    let patient;

    beforeEach(async () => {
      const userData = {
        email: 'guardian@example.com',
        password_hash: await bcrypt.hash('password123', 10),
        name: '監護人',
        role: 'family',
        phone: '0912345678'
      };
      const guardianUser = await db.createUser(userData);

      const patientData = {
        name: '患者姓名',
        age: 75,
        address: '新竹市東區',
        guardian_id: guardianUser.id,
        emergency_contact: '0987654321',
        beacon_id: 'beacon-001'
      };
      patient = await db.createPatient(patientData);
    });

    test('should create a new alert', async () => {
      const alertData = {
        patient_id: patient.id,
        type: 'geofence_exit',
        message: '患者離開安全區域',
        location: { lat: 24.8047, lng: 120.9714 }
      };

      const alert = await db.createAlert(alertData);

      expect(alert).toHaveProperty('id');
      expect(alert.patient_id).toBe(patient.id);
      expect(alert.type).toBe(alertData.type);
      expect(alert.message).toBe(alertData.message);
      expect(alert.is_resolved).toBe(false);
    });

    test('should get alerts by patient id', async () => {
      const alertData = {
        patient_id: patient.id,
        type: 'geofence_exit',
        message: '患者離開安全區域',
        location: { lat: 24.8047, lng: 120.9714 }
      };

      await db.createAlert(alertData);

      const alerts = await db.getAlertsByPatientId(patient.id);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe(alertData.type);
      expect(alerts[0].location).toEqual(alertData.location);
    });

    test('should resolve alert', async () => {
      const alertData = {
        patient_id: patient.id,
        type: 'geofence_exit',
        message: '患者離開安全區域',
        location: { lat: 24.8047, lng: 120.9714 }
      };

      const alert = await db.createAlert(alertData);
      const resolvedAlert = await db.resolveAlert(alert.id);

      expect(resolvedAlert.is_resolved).toBe(true);
    });
  });

  describe('Beacon Status Operations', () => {
    test('should update beacon status', async () => {
      const beaconId = 'beacon-001';
      const statusData = {
        rssi: -65,
        battery: 85
      };

      const beaconStatus = await db.updateBeaconStatus(beaconId, statusData);

      expect(beaconStatus.beacon_id).toBe(beaconId);
      expect(beaconStatus.rssi).toBe(statusData.rssi);
      expect(beaconStatus.battery).toBe(statusData.battery);
      expect(beaconStatus).toHaveProperty('last_seen');
    });

    test('should get beacon status', async () => {
      const beaconId = 'beacon-001';
      const statusData = {
        rssi: -65,
        battery: 85
      };

      await db.updateBeaconStatus(beaconId, statusData);
      const beaconStatus = await db.getBeaconStatus(beaconId);

      expect(beaconStatus).toBeTruthy();
      expect(beaconStatus.beacon_id).toBe(beaconId);
      expect(beaconStatus.rssi).toBe(statusData.rssi);
      expect(beaconStatus.battery).toBe(statusData.battery);
    });

    test('should update existing beacon status', async () => {
      const beaconId = 'beacon-001';
      const statusData1 = {
        rssi: -65,
        battery: 85
      };
      const statusData2 = {
        rssi: -70,
        battery: 80
      };

      await db.updateBeaconStatus(beaconId, statusData1);
      await db.updateBeaconStatus(beaconId, statusData2);

      const beaconStatus = await db.getBeaconStatus(beaconId);

      expect(beaconStatus.rssi).toBe(statusData2.rssi);
      expect(beaconStatus.battery).toBe(statusData2.battery);
    });
  });
});