const { Pool } = require('pg');
require('dotenv').config();

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error.message);
      throw error;
    }
  }

  async getClient() {
    return await this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }

  // Notification operations
  async getUserNotifications(userId, options = {}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1 ${unreadOnly ? 'AND is_read = false' : ''}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async getUnreadNotificationCount(userId) {
    const query = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false';
    const result = await this.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  async getNotificationById(id) {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async markNotificationAsRead(id) {
    const query = 'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1';
    await this.query(query, [id]);
  }

  async markAllNotificationsAsRead(userId) {
    const query = 'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false';
    await this.query(query, [userId]);
  }

  async deleteNotification(id) {
    const query = 'DELETE FROM notifications WHERE id = $1';
    await this.query(query, [id]);
  }

  async createNotification(data) {
    const { user_id, type, title, message, data: metadata, is_read = false } = data;
    const query = `
      INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    const result = await this.query(query, [user_id, type, title, message, metadata, is_read]);
    return result.rows[0];
  }

  // Emergency operations
  async createEmergencyAlert(data) {
    const { user_id, patient_id, type, severity, message, location, battery_level, status, triggered_at } = data;
    const query = `
      INSERT INTO emergency_alerts
      (user_id, patient_id, type, severity, message, location, battery_level, status, triggered_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await this.query(query, [
      user_id, patient_id, type, severity, message,
      JSON.stringify(location), battery_level, status, triggered_at
    ]);
    return result.rows[0];
  }

  async getEmergencyAlertById(id) {
    const query = 'SELECT * FROM emergency_alerts WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async updateEmergencyAlert(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
    const query = `UPDATE emergency_alerts SET ${setClause} WHERE id = $1`;
    await this.query(query, [id, ...values]);
  }

  async getUserEmergencyAlerts(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const query = `
      SELECT * FROM emergency_alerts
      WHERE user_id = $1
      ORDER BY triggered_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async getPatientEmergencyContacts(patientId) {
    const query = 'SELECT * FROM emergency_contacts WHERE patient_id = $1';
    const result = await this.query(query, [patientId]);
    return result.rows;
  }

  async getUserEmergencyContacts(userId) {
    const query = 'SELECT * FROM emergency_contacts WHERE user_id = $1';
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  async addEmergencyContact(data) {
    const { user_id, name, phone, email, relationship } = data;
    const query = `
      INSERT INTO emergency_contacts (user_id, name, phone, email, relationship, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const result = await this.query(query, [user_id, name, phone, email, relationship]);
    return result.rows[0];
  }

  async getEmergencyContactById(id) {
    const query = 'SELECT * FROM emergency_contacts WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async deleteEmergencyContact(id) {
    const query = 'DELETE FROM emergency_contacts WHERE id = $1';
    await this.query(query, [id]);
  }

  // Location sharing operations
  async createLocationShareSession(data) {
    const { user_id, patient_id, share_code, share_url, expires_at, is_active, allow_tracking, message, created_at } = data;
    const query = `
      INSERT INTO location_share_sessions
      (user_id, patient_id, share_code, share_url, expires_at, is_active, allow_tracking, message, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await this.query(query, [
      user_id, patient_id, share_code, share_url, expires_at,
      is_active, allow_tracking, message, created_at
    ]);
    return result.rows[0];
  }

  async getLocationShareSessionByCode(shareCode) {
    const query = 'SELECT * FROM location_share_sessions WHERE share_code = $1';
    const result = await this.query(query, [shareCode]);
    return result.rows[0];
  }

  async getLocationShareSessionById(id) {
    const query = 'SELECT * FROM location_share_sessions WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async updateLocationShareSession(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
    const query = `UPDATE location_share_sessions SET ${setClause} WHERE id = $1`;
    await this.query(query, [id, ...values]);
  }

  async getUserActiveShareSessions(userId) {
    const query = `
      SELECT * FROM location_share_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  async getUserShareHistory(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const query = `
      SELECT * FROM location_share_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async getLatestPatientLocation(patientId) {
    const query = `
      SELECT * FROM locations
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.query(query, [patientId]);
    return result.rows[0];
  }

  async getLatestUserLocation(userId) {
    const query = `
      SELECT * FROM locations
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.query(query, [userId]);
    return result.rows[0];
  }

  async logLocationShareAccess(data) {
    const { session_id, accessed_at, ip_address } = data;
    const query = `
      INSERT INTO location_share_access_logs (session_id, accessed_at, ip_address)
      VALUES ($1, $2, $3)
    `;
    await this.query(query, [session_id, accessed_at, ip_address]);
  }

  async logEvent(data) {
    const { type, user_id, patient_id, description, metadata } = data;
    const query = `
      INSERT INTO event_logs (type, user_id, patient_id, description, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;
    await this.query(query, [type, user_id, patient_id, description, JSON.stringify(metadata)]);
  }

  // User operations
  async createUser(userData) {
    const { email, password_hash, name, role, phone, firebase_uid } = userData;
    const query = `
      INSERT INTO users (email, password_hash, name, role, phone, firebase_uid, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, email, name, role, created_at
    `;
    const values = [email, password_hash, name, role, phone, firebase_uid];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query(query, [email]);
    return result.rows[0];
  }

  async getUserById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async updateUserFCMToken(userId, fcmToken) {
    const query = 'UPDATE users SET fcm_token = $1 WHERE id = $2';
    await this.query(query, [fcmToken, userId]);
  }

  async updateUserLastLogin(userId) {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
    await this.query(query, [userId]);
  }

  // Patient operations
  async createPatient(patientData) {
    const { name, age, address, guardian_id, emergency_contact, beacon_id, photo_url } = patientData;
    const query = `
      INSERT INTO patients (name, age, address, guardian_id, emergency_contact, beacon_id, photo_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [name, age, address, guardian_id, emergency_contact, beacon_id, photo_url];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getPatientsByGuardianId(guardianId) {
    const query = 'SELECT * FROM patients WHERE guardian_id = $1 ORDER BY created_at DESC';
    const result = await this.query(query, [guardianId]);
    return result.rows;
  }

  async getPatientById(id) {
    const query = 'SELECT * FROM patients WHERE id = $1';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async updatePatient(id, patientData) {
    const { name, age, address, emergency_contact, beacon_id, photo_url } = patientData;
    const query = `
      UPDATE patients
      SET name = $1, age = $2, address = $3, emergency_contact = $4, beacon_id = $5, photo_url = $6
      WHERE id = $7
      RETURNING *
    `;
    const values = [name, age, address, emergency_contact, beacon_id, photo_url, id];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  // Location operations
  async createLocation(locationData) {
    const { patient_id, latitude, longitude, accuracy, battery_level } = locationData;
    const query = `
      INSERT INTO locations (patient_id, latitude, longitude, accuracy, battery_level, timestamp)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const values = [patient_id, latitude, longitude, accuracy, battery_level];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getLocationHistory(patientId, limit = 100) {
    const query = `
      SELECT * FROM locations
      WHERE patient_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await this.query(query, [patientId, limit]);
    return result.rows;
  }

  async getLatestLocation(patientId) {
    const query = `
      SELECT * FROM locations
      WHERE patient_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const result = await this.query(query, [patientId]);
    return result.rows[0];
  }

  // Geofence operations
  async createGeofence(geofenceData) {
    const { patient_id, name, center_lat, center_lng, radius } = geofenceData;
    const query = `
      INSERT INTO geofences (patient_id, name, center_lat, center_lng, radius, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW())
      RETURNING *
    `;
    const values = [patient_id, name, center_lat, center_lng, radius];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getGeofencesByPatientId(patientId) {
    const query = 'SELECT * FROM geofences WHERE patient_id = $1 AND is_active = true';
    const result = await this.query(query, [patientId]);
    return result.rows;
  }

  async updateGeofence(id, geofenceData) {
    const { name, center_lat, center_lng, radius, is_active } = geofenceData;
    const query = `
      UPDATE geofences
      SET name = $1, center_lat = $2, center_lng = $3, radius = $4, is_active = $5
      WHERE id = $6
      RETURNING *
    `;
    const values = [name, center_lat, center_lng, radius, is_active, id];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  // Alert operations
  async createAlert(alertData) {
    const { patient_id, type, message, location } = alertData;
    const query = `
      INSERT INTO alerts (patient_id, type, message, location, is_resolved, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      RETURNING *
    `;
    const values = [patient_id, type, message, JSON.stringify(location)];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getAlertsByPatientId(patientId) {
    const query = 'SELECT * FROM alerts WHERE patient_id = $1 ORDER BY created_at DESC';
    const result = await this.query(query, [patientId]);
    return result.rows.map(row => ({
      ...row,
      location: typeof row.location === 'string' ? JSON.parse(row.location) : row.location
    }));
  }

  async resolveAlert(id) {
    const query = 'UPDATE alerts SET is_resolved = true WHERE id = $1 RETURNING *';
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  // Beacon status operations
  async updateBeaconStatus(beaconId, statusData) {
    const { rssi, battery } = statusData;
    const query = `
      INSERT INTO beacon_status (beacon_id, rssi, battery, last_seen)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (beacon_id)
      DO UPDATE SET rssi = $2, battery = $3, last_seen = NOW()
      RETURNING *
    `;
    const values = [beaconId, rssi, battery];
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getBeaconStatus(beaconId) {
    const query = 'SELECT * FROM beacon_status WHERE beacon_id = $1';
    const result = await this.query(query, [beaconId]);
    return result.rows[0];
  }
}

// Export singleton instance
const db = new Database();
module.exports = db;