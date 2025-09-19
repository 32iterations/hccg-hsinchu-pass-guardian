import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';

// Backend API configuration
const API_URL = API_BASE_URL; // Using config.ts for centralized API URL

// API Service class
class ApiService {
  private token: string | null = null;

  constructor() {
    this.loadToken();
  }

  private async loadToken() {
    try {
      this.token = await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error loading token:', error);
    }
  }

  private async saveToken(token: string) {
    try {
      await AsyncStorage.setItem('authToken', token);
      this.token = token;
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  private getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Authentication endpoints
  async login(email: string, password: string, role?: string) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await this.saveToken(data.token);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.error || '登入失敗' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async register(email: string, password: string, name: string, role: string, phone?: string) {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password, name, role, phone }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await this.saveToken(data.token);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.error || '註冊失敗' };
      }
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async logout() {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userRole', 'userToken']);
      this.token = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: '登出失敗' };
    }
  }

  // Patient management endpoints
  async getPatients() {
    try {
      const response = await fetch(`${API_URL}/api/patients`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, patients: data.patients };
      } else {
        return { success: false, error: data.error || '無法取得患者列表' };
      }
    } catch (error) {
      console.error('Get patients error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async addPatient(patient: {
    name: string;
    age: number;
    address: string;
    emergency_contact: string;
    beacon_id?: string;
  }) {
    try {
      const response = await fetch(`${API_URL}/api/patients`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(patient),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, patient: data.patient };
      } else {
        return { success: false, error: data.error || '新增患者失敗' };
      }
    } catch (error) {
      console.error('Add patient error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // Location tracking endpoints
  async updateLocation(patientId: string, latitude: number, longitude: number, source: string = 'gps') {
    try {
      const response = await fetch(`${API_URL}/api/locations`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          patient_id: patientId,
          latitude,
          longitude,
          source,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, location: data.location };
      } else {
        return { success: false, error: data.error || '位置更新失敗' };
      }
    } catch (error) {
      console.error('Update location error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async getLocationHistory(patientId: string, hours: number = 24) {
    try {
      const response = await fetch(`${API_URL}/api/locations/${patientId}?hours=${hours}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, locations: data.locations };
      } else {
        return { success: false, error: data.error || '無法取得位置歷史' };
      }
    } catch (error) {
      console.error('Get location history error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // Geofence management endpoints
  async getGeofences(patientId?: string) {
    try {
      // 改為不帶 patientId 參數，獲取所有地理圍欄
      const response = await fetch(`${API_URL}/api/geofences`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, geofences: data.geofences };
      } else {
        return { success: false, error: data.error || '無法取得地理圍欄' };
      }
    } catch (error) {
      console.error('Get geofences error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // 位置模擬相關 API
  async getSimulationScenarios() {
    try {
      const response = await fetch(`${API_URL}/api/simulation/scenarios`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, scenarios: data.scenarios };
      } else {
        return { success: false, error: data.error || '無法取得模擬場景' };
      }
    } catch (error) {
      console.error('Get simulation scenarios error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async startSimulation(scenarioId: string, speed: number = 1) {
    try {
      const response = await fetch(`${API_URL}/api/simulation/start`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ scenarioId, patientId, speed }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, simulationId: data.simulationId };
      } else {
        return { success: false, error: data.error || '無法開始模擬' };
      }
    } catch (error) {
      console.error('Start simulation error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async getSimulationStatus(simulationId: string) {
    try {
      const response = await fetch(`${API_URL}/api/simulation/current/${simulationId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, position: data.position, simulation: data.simulation };
      } else {
        return { success: false, error: data.error || '無法取得模擬位置' };
      }
    } catch (error) {
      console.error('Get simulation position error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async stopSimulation(simulationId: string) {
    try {
      const response = await fetch(`${API_URL}/api/simulation/stop/${simulationId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || '無法停止模擬' };
      }
    } catch (error) {
      console.error('Stop simulation error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async createGeofence(geofence: {
    patient_id: string;
    name: string;
    center_lat: number;
    center_lng: number;
    radius: number;
  }) {
    try {
      const response = await fetch(`${API_URL}/api/geofences`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(geofence),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, geofence: data.geofence };
      } else {
        return { success: false, error: data.error || '建立地理圍欄失敗' };
      }
    } catch (error) {
      console.error('Create geofence error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // Alert endpoints
  async getAlerts() {
    try {
      const response = await fetch(`${API_URL}/api/alerts`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, alerts: data.alerts };
      } else {
        return { success: false, error: data.error || '無法取得警報' };
      }
    } catch (error) {
      console.error('Get alerts error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async markAlertRead(alertId: string) {
    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertId}/read`, {
        method: 'PUT',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || '標記警報失敗' };
      }
    } catch (error) {
      console.error('Mark alert read error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // Profile management endpoints
  async updateProfile(name: string, phone: string) {
    try {
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, phone }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || '更新資料失敗' };
      }
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // Emergency endpoints
  async sendEmergencyAlert() {
    try {
      const response = await fetch(`${API_URL}/api/emergency/sos`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: 'manual'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || '緊急求救發送失敗' };
      }
    } catch (error) {
      console.error('Send emergency alert error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  async shareCurrentLocation() {
    try {
      // Get current location first
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const { latitude, longitude } = position.coords;

      const response = await fetch(`${API_URL}/api/location/share`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          latitude,
          longitude,
          timestamp: new Date().toISOString()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || '分享位置失敗' };
      }
    } catch (error) {
      console.error('Share location error:', error);
      return { success: false, error: '無法取得位置或網路連線錯誤' };
    }
  }

  async getEmergencyContacts() {
    try {
      const response = await fetch(`${API_URL}/api/emergency/contacts`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, contacts: data.contacts };
      } else {
        return { success: false, error: data.error || '無法取得緊急聯絡人' };
      }
    } catch (error) {
      console.error('Get emergency contacts error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }

  // Push notification endpoints
  async updateFCMToken(fcmToken: string) {
    try {
      const response = await fetch(`${API_URL}/api/notifications/token`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ fcm_token: fcmToken }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'FCM Token 更新失敗' };
      }
    } catch (error) {
      console.error('Update FCM token error:', error);
      return { success: false, error: '網路連線錯誤' };
    }
  }
}

export default new ApiService();