import Geolocation from 'react-native-geolocation-service';
import BackgroundTimer from 'react-native-background-timer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { API_BASE_URL, GEOFENCE_CONFIG } from '../config';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
}

class GeofenceMonitoringService {
  private monitoring: boolean = false;
  private watchId: number | null = null;
  private checkInterval: number | null = null;
  private locationHistory: LocationData[] = [];
  private lastCheckedLocation: LocationData | null = null;
  private token: string | null = null;
  private patientId: number | null = null;

  async initialize(token: string, patientId: number) {
    this.token = token;
    this.patientId = patientId;

    // Load previous location history
    const history = await AsyncStorage.getItem('location_history');
    if (history) {
      this.locationHistory = JSON.parse(history);
    }

    // Setup Firebase messaging for background notifications
    this.setupBackgroundMessaging();
  }

  setupBackgroundMessaging() {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);

      // Handle geofence alerts in background
      if (remoteMessage.data?.type === 'GEOFENCE_ALERT') {
        // Show local notification or handle the alert
      }
    });
  }

  startMonitoring() {
    if (this.monitoring) return;

    this.monitoring = true;
    console.log('Starting geofence monitoring...');

    // Start continuous location watching
    this.watchId = Geolocation.watchPosition(
      (position) => {
        this.handleLocationUpdate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.error('Location watch error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: 10000, // Update at least every 10 seconds
        fastestInterval: 5000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );

    // Start periodic geofence checking (every 30 seconds)
    BackgroundTimer.runBackgroundTimer(() => {
      this.checkGeofences();
      this.checkForAnomalies();
    }, GEOFENCE_CONFIG.CHECK_INTERVAL);

    // Also check immediately
    this.checkGeofences();
  }

  stopMonitoring() {
    this.monitoring = false;
    console.log('Stopping geofence monitoring...');

    // Stop location watching
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    // Stop background timer
    BackgroundTimer.stopBackgroundTimer();

    // Save location history
    this.saveLocationHistory();
  }

  private async handleLocationUpdate(location: LocationData) {
    // Add to history
    this.locationHistory.push(location);

    // Keep only last 100 locations
    if (this.locationHistory.length > 100) {
      this.locationHistory = this.locationHistory.slice(-100);
    }

    // Save to storage periodically
    if (this.locationHistory.length % 10 === 0) {
      await this.saveLocationHistory();
    }

    // Update last checked location
    this.lastCheckedLocation = location;

    // Check geofences if significant movement (> 20 meters)
    if (this.shouldCheckGeofences(location)) {
      await this.checkGeofences();
    }
  }

  private shouldCheckGeofences(newLocation: LocationData): boolean {
    if (!this.lastCheckedLocation) return true;

    const distance = this.calculateDistance(
      newLocation.latitude,
      newLocation.longitude,
      this.lastCheckedLocation.latitude,
      this.lastCheckedLocation.longitude
    );

    return distance > 20; // Check if moved more than 20 meters
  }

  private async checkGeofences() {
    if (!this.token || !this.patientId || !this.lastCheckedLocation) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/geofences/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: this.patientId,
          latitude: this.lastCheckedLocation.latitude,
          longitude: this.lastCheckedLocation.longitude,
          timestamp: this.lastCheckedLocation.timestamp,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Handle alerts
        if (data.alerts && data.alerts.length > 0) {
          for (const alert of data.alerts) {
            await this.handleGeofenceAlert(alert);
          }
        }

        // Store status
        await AsyncStorage.setItem('geofence_status', JSON.stringify(data.statuses));
      }
    } catch (error) {
      console.error('Geofence check error:', error);
    }
  }

  private async handleGeofenceAlert(alert: any) {
    console.log('Geofence alert:', alert);

    // Store alert in history
    const alertHistory = await AsyncStorage.getItem('geofence_alerts');
    const history = alertHistory ? JSON.parse(alertHistory) : [];
    history.push(alert);

    // Keep only last 50 alerts
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    await AsyncStorage.setItem('geofence_alerts', JSON.stringify(history));

    // Show local notification (requires react-native-push-notification setup)
    // This is a placeholder - implement with actual notification library
    if (alert.type === 'EXIT_GEOFENCE') {
      console.warn('ALERT: Patient left safe zone!', alert.message);
    } else if (alert.type === 'ENTER_GEOFENCE') {
      console.log('INFO: Patient entered safe zone', alert.message);
    }
  }

  private async checkForAnomalies() {
    if (!this.token || !this.patientId || this.locationHistory.length < 2) return;

    try {
      // Get locations from last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - GEOFENCE_CONFIG.ANOMALY_THRESHOLD * 60 * 1000);
      const recentLocations = this.locationHistory.filter(
        loc => new Date(loc.timestamp) > thirtyMinutesAgo
      );

      if (recentLocations.length < 2) return;

      const response = await fetch(`${API_BASE_URL}/api/anomaly/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: this.patientId,
          locations: recentLocations,
          threshold_minutes: GEOFENCE_CONFIG.ANOMALY_THRESHOLD,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.anomaly_detected) {
          console.warn('Anomaly detected: No movement for extended period');

          // Store anomaly alert
          const anomalyHistory = await AsyncStorage.getItem('anomaly_alerts');
          const history = anomalyHistory ? JSON.parse(anomalyHistory) : [];
          history.push({
            timestamp: new Date().toISOString(),
            type: 'NO_MOVEMENT',
            duration: GEOFENCE_CONFIG.ANOMALY_THRESHOLD,
            location: this.lastCheckedLocation,
          });
          await AsyncStorage.setItem('anomaly_alerts', JSON.stringify(history));
        }
      }
    } catch (error) {
      console.error('Anomaly check error:', error);
    }
  }

  private async saveLocationHistory() {
    try {
      await AsyncStorage.setItem('location_history', JSON.stringify(this.locationHistory));
    } catch (error) {
      console.error('Failed to save location history:', error);
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  async getLocationHistory(): Promise<LocationData[]> {
    return this.locationHistory;
  }

  async getGeofenceStatus(): Promise<any> {
    const status = await AsyncStorage.getItem('geofence_status');
    return status ? JSON.parse(status) : null;
  }

  async getAlertHistory(): Promise<any[]> {
    const alerts = await AsyncStorage.getItem('geofence_alerts');
    return alerts ? JSON.parse(alerts) : [];
  }

  isMonitoring(): boolean {
    return this.monitoring;
  }
}

// Export singleton instance
export default new GeofenceMonitoringService();