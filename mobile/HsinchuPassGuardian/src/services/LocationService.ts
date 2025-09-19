import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

class LocationService {
  private isLocationEnabled = false;

  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '位置權限',
            message: '新竹通行守護者需要位置權限來提供位置服務',
            buttonNeutral: '稍後詢問',
            buttonNegative: '拒絕',
            buttonPositive: '同意',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted');
          this.isLocationEnabled = true;
          return true;
        } else {
          console.log('Location permission denied');
          return false;
        }
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    } else {
      // iOS permission will be handled by the library
      this.isLocationEnabled = true;
      return true;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    if (!this.isLocationEnabled) {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        return null;
      }
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          resolve(locationData);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          // 如果無法獲取GPS位置，回傳新竹市區的模擬位置
          Alert.alert(
            '位置服務',
            'GPS定位失敗，使用模擬位置（新竹火車站）',
            [{ text: '確定' }]
          );

          const simulatedLocation: LocationData = {
            latitude: 24.8019, // 新竹火車站
            longitude: 120.9718,
            accuracy: 50,
            timestamp: Date.now(),
          };
          resolve(simulatedLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  // 模擬位置更新（用於測試）
  getSimulatedLocation(): LocationData {
    // 在新竹市區範圍內隨機生成位置
    const baseLatitude = 24.8019;
    const baseLongitude = 120.9718;
    const range = 0.01; // 約1公里範圍

    return {
      latitude: baseLatitude + (Math.random() - 0.5) * range,
      longitude: baseLongitude + (Math.random() - 0.5) * range,
      accuracy: 10 + Math.random() * 20,
      timestamp: Date.now(),
    };
  }

  // 獲取位置（如果GPS失敗則使用模擬位置）
  async getLocationWithFallback(): Promise<LocationData> {
    try {
      const location = await this.getCurrentLocation();
      if (location) {
        return location;
      }
    } catch (error) {
      console.warn('Location service error:', error);
    }

    // 如果所有方法都失敗，使用模擬位置
    return this.getSimulatedLocation();
  }

  // 停止位置更新
  stopLocationUpdates() {
    Geolocation.stopObserving();
  }
}

export default new LocationService();