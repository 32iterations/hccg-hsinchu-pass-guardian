import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend API configuration
const API_URL = 'http://localhost:3000'; // Using localhost since backend is running locally

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
  async getGeofences(patientId: string) {
    try {
      const response = await fetch(`${API_URL}/api/geofences/${patientId}`, {
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