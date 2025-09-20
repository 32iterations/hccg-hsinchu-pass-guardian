import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export interface Patient {
  id: number;
  name: string;
  age: number;
  address: string;
  emergency_contact: string;
  beacon_id?: string;
  guardian_id: number;
}

export interface Location {
  id?: number;
  patient_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  battery_level?: number;
  timestamp?: string;
}

export interface Geofence {
  id?: number;
  name: string;
  patient_id: number;
  guardian_id?: number;
  center_latitude: number;
  center_longitude: number;
  radius: number;
  description?: string;
  alert_on_exit?: boolean;
  alert_on_enter?: boolean;
  emergency_contacts?: string[];
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Alert {
  id: number;
  patient_id: number;
  type: string;
  message: string;
  location?: Location;
  timestamp: string;
  is_resolved: boolean;
  patient_name?: string;
}

class APIService {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const token = await this.getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // ==================== AUTH METHODS ====================

  async login(email: string, password: string) {
    return this.makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    phone: string;
  }) {
    return this.makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // ==================== PATIENT METHODS ====================

  async getPatients(): Promise<{ success: boolean; patients: Patient[] }> {
    return this.makeRequest('/api/patients');
  }

  async createPatient(patientData: Omit<Patient, 'id' | 'guardian_id'>) {
    return this.makeRequest('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  }

  // ==================== LOCATION METHODS ====================

  async updateLocation(locationData: Omit<Location, 'id' | 'timestamp'>) {
    return this.makeRequest('/api/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  async getLocationHistory(patientId: number): Promise<{ success: boolean; locations: Location[] }> {
    return this.makeRequest(`/api/locations/${patientId}/history`);
  }

  // ==================== GEOFENCE METHODS ====================

  async getGeofences(): Promise<{ success: boolean; geofences: Geofence[] }> {
    return this.makeRequest('/api/geofences');
  }

  async createGeofence(geofenceData: Omit<Geofence, 'id' | 'guardian_id' | 'created_at' | 'updated_at'>) {
    return this.makeRequest('/api/geofences', {
      method: 'POST',
      body: JSON.stringify(geofenceData),
    });
  }

  async updateGeofence(id: number, updates: Partial<Geofence>) {
    return this.makeRequest(`/api/geofences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteGeofence(id: number) {
    return this.makeRequest(`/api/geofences/${id}`, {
      method: 'DELETE',
    });
  }

  async checkGeofences(locationData: {
    patient_id: number;
    latitude: number;
    longitude: number;
    timestamp?: string;
  }) {
    return this.makeRequest('/api/geofences/check', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  // ==================== ALERT METHODS ====================

  async getAlerts(): Promise<{ success: boolean; alerts: Alert[] }> {
    return this.makeRequest('/api/alerts');
  }

  async resolveAlert(alertId: number) {
    return this.makeRequest(`/api/alerts/${alertId}/resolve`, {
      method: 'PUT',
    });
  }

  async getAlertDetails(alertId: number): Promise<{ success: boolean; alert: Alert }> {
    return this.makeRequest(`/api/alerts/${alertId}`);
  }

  // ==================== EMERGENCY METHODS ====================

  async sendSOS(data: {
    patient_id: number;
    latitude: number;
    longitude: number;
    message?: string;
    battery_level?: number;
  }) {
    return this.makeRequest('/api/sos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async shareLocation(data: {
    latitude: number;
    longitude: number;
    message?: string;
    contacts?: string[];
  }) {
    return this.makeRequest('/api/location/share', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEmergencyContacts() {
    return this.makeRequest('/api/emergency/contacts');
  }

  // ==================== SIMULATION METHODS ====================

  async getSimulationScenarios() {
    return this.makeRequest('/api/simulation/scenarios');
  }

  async startSimulation(scenarioId: string, patientId?: number, speed?: number) {
    return this.makeRequest('/api/simulation/start', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, patientId, speed }),
    });
  }

  async getCurrentSimulation(simulationId: string) {
    return this.makeRequest(`/api/simulation/current/${simulationId}`);
  }

  async stopSimulation(simulationId: string) {
    return this.makeRequest(`/api/simulation/stop/${simulationId}`, {
      method: 'POST',
    });
  }

  async getActiveSimulations() {
    return this.makeRequest('/api/simulation/active');
  }

  // ==================== NOTIFICATION METHODS ====================

  async updateFCMToken(fcmToken: string) {
    return this.makeRequest('/api/notifications/register', {
      method: 'POST',
      body: JSON.stringify({ fcm_token: fcmToken }),
    });
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    return this.makeRequest('/health');
  }

  // ==================== TEST METHODS ====================

  async createTestUser() {
    return this.makeRequest('/api/test/create-user', {
      method: 'POST',
    });
  }
}

export const apiService = new APIService();
export default apiService;