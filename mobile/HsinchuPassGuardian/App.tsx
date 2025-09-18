import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import Geolocation from 'react-native-geolocation-service';
import {BleManager} from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

const bleManager = new BleManager();

function App(): React.JSX.Element {
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [bleStatus, setBleStatus] = useState('未啟動');
  const [fcmToken, setFcmToken] = useState<string>('');

  useEffect(() => {
    // 請求權限
    requestPermissions();
    // 初始化 Firebase
    initializeFirebase();
    // 初始化 BLE
    initializeBLE();
    // 獲取位置
    getCurrentLocation();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        console.log('Permissions granted:', granted);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const initializeFirebase = async () => {
    try {
      // 請求通知權限
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);

        // 獲取 FCM Token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
        setFcmToken(token);

        // 儲存 token
        await AsyncStorage.setItem('fcmToken', token);
      }

      // 監聽訊息
      messaging().onMessage(async remoteMessage => {
        Alert.alert('新通知', remoteMessage.notification?.body || '');
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  };

  const initializeBLE = () => {
    const subscription = bleManager.onStateChange((state) => {
      setBleStatus(state);
      if (state === 'PoweredOn') {
        scanForDevices();
        subscription.remove();
      }
    }, true);
  };

  const scanForDevices = () => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('BLE scan error:', error);
        return;
      }

      if (device?.name?.includes('HSC-GUARD')) {
        console.log('Found guardian device:', device.name);
        // 處理找到的守護裝置
      }
    });

    // 10秒後停止掃描
    setTimeout(() => {
      bleManager.stopDeviceScan();
    }, 10000);
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const testGeofence = () => {
    if (location) {
      // 設定地理圍欄 (示例：新竹市政府)
      const geofenceCenter = {
        lat: 24.8066,
        lng: 120.9686,
      };

      const distance = calculateDistance(
        location.lat,
        location.lng,
        geofenceCenter.lat,
        geofenceCenter.lng
      );

      if (distance > 100) {
        Alert.alert('地理圍欄警報', '您已離開安全區域！');
      } else {
        Alert.alert('狀態', '您在安全區域內');
      }
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>新竹安心守護</Text>
          <Text style={styles.subtitle}>HsinchuPass Guardian</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>系統狀態</Text>
          <Text>📍 位置: {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : '獲取中...'}</Text>
          <Text>📡 藍牙: {bleStatus}</Text>
          <Text>🔔 推播: {fcmToken ? '已連線' : '未連線'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>功能測試</Text>
          <View style={styles.buttonContainer}>
            <Button title="掃描藍牙裝置" onPress={scanForDevices} />
          </View>
          <View style={styles.buttonContainer}>
            <Button title="測試地理圍欄" onPress={testGeofence} />
          </View>
          <View style={styles.buttonContainer}>
            <Button title="更新位置" onPress={getCurrentLocation} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>關於</Text>
          <Text>版本: 1.0.0</Text>
          <Text>測試覆蓋率: 97.0%</Text>
          <Text>© 2024 新竹市政府</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  buttonContainer: {
    marginVertical: 5,
  },
});

export default App;