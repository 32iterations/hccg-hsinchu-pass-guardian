import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LeafletMap from '../../components/LeafletMap';
import apiService from '../../services/api';

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  guardian_id: number;
  created_at: string;
}

interface Location {
  id: number;
  patient_id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  patient_name?: string;
  status?: 'normal' | 'warning' | 'alert';
}

const LeafletRealTimeMapScreen = ({ navigation, route }: any) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientLocations, setPatientLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const locationUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const geofenceCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // 新竹市中心坐標
  const HSINCHU_CENTER = { latitude: 24.8074, longitude: 120.98175 };

  useEffect(() => {
    initializeScreen();
    setupNetworkListener();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (selectedPatient && isMapReady) {
      startRealTimeUpdates();
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [selectedPatient, isMapReady]);

  const initializeScreen = async () => {
    try {
      console.log('[LeafletRealTimeMapScreen] Initializing screen...');
      await loadPatients();
      setIsLoading(false);
    } catch (error) {
      console.error('[LeafletRealTimeMapScreen] Initialization error:', error);
      setIsLoading(false);
      Alert.alert('錯誤', '初始化失敗，請檢查網路連線');
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (state.isConnected && selectedPatient) {
        // 網路恢復時重新加載數據
        loadPatientData(selectedPatient.id);
      }
    });

    return unsubscribe;
  };

  const loadPatients = async () => {
    try {
      console.log('[LeafletRealTimeMapScreen] Loading patients...');
      const response = await apiService.getPatients();

      if (response.success && response.patients) {
        setPatients(response.patients);

        // 自動選擇第一個患者（如果有的話）
        if (response.patients.length > 0) {
          const firstPatient = response.patients[0];
          setSelectedPatient(firstPatient);
          console.log('[LeafletRealTimeMapScreen] Auto-selected first patient:', firstPatient.name);
        }
      } else {
        console.error('[LeafletRealTimeMapScreen] Failed to load patients:', response);
      }
    } catch (error) {
      console.error('[LeafletRealTimeMapScreen] Error loading patients:', error);
      throw error;
    }
  };

  const loadPatientData = async (patientId: number) => {
    try {
      console.log('[LeafletRealTimeMapScreen] Loading patient data for ID:', patientId);

      const locationResponse = await apiService.getLocationHistory(patientId);

      if (locationResponse.success && locationResponse.locations) {
        const locations = locationResponse.locations.map((loc: any) => ({
          ...loc,
          patient_name: selectedPatient?.name,
          status: determineLocationStatus(loc),
        }));

        setPatientLocations(locations);
        setLastUpdated(new Date());

        console.log('[LeafletRealTimeMapScreen] Loaded locations:', locations.length);
      } else {
        console.error('[LeafletRealTimeMapScreen] Failed to load location data:', locationResponse);
      }
    } catch (error) {
      console.error('[LeafletRealTimeMapScreen] Error loading patient data:', error);
    }
  };

  const determineLocationStatus = (location: any): 'normal' | 'warning' | 'alert' => {
    // 根據時間戳判斷狀態
    const locationTime = new Date(location.timestamp);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - locationTime.getTime()) / (1000 * 60);

    if (timeDiffMinutes > 60) {
      return 'alert'; // 超過1小時沒有更新
    } else if (timeDiffMinutes > 30) {
      return 'warning'; // 超過30分鐘沒有更新
    }

    return 'normal';
  };

  const startRealTimeUpdates = () => {
    if (!selectedPatient) return;

    console.log('[LeafletRealTimeMapScreen] Starting real-time updates...');

    // 立即加載一次數據
    loadPatientData(selectedPatient.id);

    // 每30秒更新一次位置數據
    locationUpdateInterval.current = setInterval(() => {
      if (isConnected && selectedPatient) {
        loadPatientData(selectedPatient.id);
      }
    }, 30000);

    // 每15秒檢查一次地理圍欄狀態
    geofenceCheckInterval.current = setInterval(() => {
      if (isConnected && selectedPatient && patientLocations.length > 0) {
        checkGeofenceStatus();
      }
    }, 15000);
  };

  const stopRealTimeUpdates = () => {
    console.log('[LeafletRealTimeMapScreen] Stopping real-time updates...');

    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
      locationUpdateInterval.current = null;
    }

    if (geofenceCheckInterval.current) {
      clearInterval(geofenceCheckInterval.current);
      geofenceCheckInterval.current = null;
    }
  };

  const checkGeofenceStatus = async () => {
    if (!selectedPatient || patientLocations.length === 0) return;

    try {
      const latestLocation = patientLocations[patientLocations.length - 1];

      const response = await apiService.checkGeofences({
        patient_id: selectedPatient.id,
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        timestamp: latestLocation.timestamp,
      });

      if (response.success && response.alerts && response.alerts.length > 0) {
        // 顯示圍欄警報
        const alertMessage = response.alerts.map((alert: any) =>
          `${alert.geofence_name}: ${alert.alert_type}`
        ).join('\n');

        Alert.alert('地理圍欄警報', alertMessage);
      }
    } catch (error) {
      console.error('[LeafletRealTimeMapScreen] Error checking geofences:', error);
    }
  };

  const cleanup = () => {
    stopRealTimeUpdates();
  };

  const handleMapReady = () => {
    console.log('[LeafletRealTimeMapScreen] Map is ready');
    setIsMapReady(true);
  };

  const refreshData = () => {
    if (selectedPatient) {
      loadPatientData(selectedPatient.id);
    }
  };

  const switchPatient = () => {
    if (patients.length <= 1) return;

    const currentIndex = patients.findIndex(p => p.id === selectedPatient?.id);
    const nextIndex = (currentIndex + 1) % patients.length;
    const nextPatient = patients[nextIndex];

    setSelectedPatient(nextPatient);
    setPatientLocations([]);
    console.log('[LeafletRealTimeMapScreen] Switched to patient:', nextPatient.name);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />

      {/* 頂部導航欄 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>即時定位追蹤</Text>
          <Text style={styles.headerSubtitle}>
            {selectedPatient ? selectedPatient.name : '無患者'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={switchPatient}
          disabled={patients.length <= 1}
        >
          <Text style={styles.switchButtonText}>切換</Text>
        </TouchableOpacity>
      </View>

      {/* 地圖區域 */}
      <View style={styles.mapContainer}>
        <LeafletMap
          locations={patientLocations}
          geofences={[]}
          mode="realtime"
          onMapReady={handleMapReady}
          currentLocation={patientLocations.length > 0 ? patientLocations[patientLocations.length - 1] : undefined}
        />
      </View>

      {/* 底部控制面板 */}
      <View style={styles.bottomPanel}>
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>監控狀態:</Text>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: isConnected ? '#10B981' : '#EF4444' }
            ]} />
            <Text style={styles.statusLabel}>
              {isConnected ? '已連線' : '離線'}
            </Text>
          </View>

          <Text style={styles.lastUpdatedText}>
            最後更新: {lastUpdated ? lastUpdated.toLocaleTimeString('zh-TW') : '無'}
          </Text>
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={refreshData}
            disabled={!isConnected || !selectedPatient}
          >
            <Text style={styles.controlButtonText}>🔄</Text>
            <Text style={styles.controlButtonLabel}>刷新</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => navigation.navigate('Geofence')}
          >
            <Text style={styles.controlButtonText}>🚧</Text>
            <Text style={styles.controlButtonLabel}>圍欄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => navigation.navigate('Alerts')}
          >
            <Text style={styles.controlButtonText}>🚨</Text>
            <Text style={styles.controlButtonLabel}>警報</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 離線提示 */}
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>⚠️ 網路連線中斷，顯示離線數據</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E3F2FD',
    fontSize: 14,
    marginTop: 2,
  },
  switchButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  switchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  bottomPanel: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusContainer: {
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#999',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    alignItems: 'center',
    padding: 8,
    minWidth: 60,
  },
  controlButtonText: {
    fontSize: 20,
    marginBottom: 4,
  },
  controlButtonLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  offlineNotice: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFF3CD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    elevation: 4,
  },
  offlineText: {
    color: '#92400E',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LeafletRealTimeMapScreen;