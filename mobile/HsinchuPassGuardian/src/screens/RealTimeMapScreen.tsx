import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
  RefreshControl,
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import apiService, { Patient, Location, Geofence, Alert as APIAlert } from '../services/api';
import { GEOFENCE_CONFIG } from '../../config';

const { width, height } = Dimensions.get('window');

interface PatientLocation extends Location {
  patient_name?: string;
  status?: 'safe' | 'warning' | 'danger';
}

interface PatientStatus {
  status: 'safe' | 'warning' | 'danger';
  lastUpdate: string;
  isOnline: boolean;
  batteryLevel?: number;
}

// 新竹地區預設座標 - 火車站
const DEFAULT_REGION: Region = {
  latitude: 24.8113,
  longitude: 120.9715,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const RealTimeMapScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);
  const locationUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const geofenceCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientLocations, setPatientLocations] = useState<PatientLocation[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [alerts, setAlerts] = useState<APIAlert[]>([]);

  // UI states
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region>(DEFAULT_REGION);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Patient status
  const [patientStatus, setPatientStatus] = useState<PatientStatus>({
    status: 'safe',
    lastUpdate: new Date().toLocaleTimeString(),
    isOnline: true,
  });

  // Animation values
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const alertPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeScreen();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientData(selectedPatient.id);
      startLocationTracking(selectedPatient.id);
    }
  }, [selectedPatient]);

  const cleanup = () => {
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
    }
    if (geofenceCheckInterval.current) {
      clearInterval(geofenceCheckInterval.current);
    }
  };

  const initializeScreen = async () => {
    console.log('[RealTimeMapScreen] Initializing screen...');

    try {
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected || false);

      if (!netInfo.isConnected) {
        Alert.alert('網路連線', '請檢查您的網路連線');
        setIsLoading(false);
        return;
      }

      // Request location permission
      await requestLocationPermission();

      // Load initial data
      await loadInitialData();

      // Initialize map
      setTimeout(() => {
        setIsMapReady(true);
        setIsLoading(false);
      }, 1500);

    } catch (error) {
      console.error('[RealTimeMapScreen] Initialization error:', error);
      Alert.alert('初始化失敗', '載入資料時發生錯誤');
      setIsLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      // Load patients
      const patientsResponse = await apiService.getPatients();
      if (patientsResponse.success) {
        setPatients(patientsResponse.patients);

        // Auto-select first patient
        if (patientsResponse.patients.length > 0) {
          setSelectedPatient(patientsResponse.patients[0]);
        }
      }

      // Load geofences
      const geofencesResponse = await apiService.getGeofences();
      if (geofencesResponse.success) {
        setGeofences(geofencesResponse.geofences);
      }

      // Load alerts
      const alertsResponse = await apiService.getAlerts();
      if (alertsResponse.success) {
        setAlerts(alertsResponse.alerts);
      }

    } catch (error) {
      console.error('[RealTimeMapScreen] Error loading initial data:', error);
    }
  };

  const loadPatientData = async (patientId: number) => {
    try {
      // Load location history
      const locationResponse = await apiService.getLocationHistory(patientId);
      if (locationResponse.success && locationResponse.locations.length > 0) {
        const locations = locationResponse.locations.map(loc => ({
          ...loc,
          patient_name: selectedPatient?.name,
          status: determineLocationStatus(loc),
        }));

        setPatientLocations(locations);

        // Update current location to most recent
        const latestLocation = locations[0];
        setCurrentLocation(latestLocation);

        // Update map region to show latest location
        if (latestLocation) {
          setCurrentRegion({
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }

        // Update patient status
        updatePatientStatus(latestLocation);
      }
    } catch (error) {
      console.error('[RealTimeMapScreen] Error loading patient data:', error);
    }
  };

  const startLocationTracking = (patientId: number) => {
    // Clear existing intervals
    cleanup();

    // Start location update interval (every 30 seconds)
    locationUpdateInterval.current = setInterval(async () => {
      await loadPatientData(patientId);
    }, 30000);

    // Start geofence checking interval (every 15 seconds)
    geofenceCheckInterval.current = setInterval(async () => {
      if (currentLocation) {
        await checkGeofenceStatus(patientId, currentLocation);
      }
    }, 15000);
  };

  const determineLocationStatus = (location: Location): 'safe' | 'warning' | 'danger' => {
    const now = new Date();
    const locationTime = new Date(location.timestamp || now);
    const minutesSinceUpdate = (now.getTime() - locationTime.getTime()) / (1000 * 60);

    // Check if location is stale
    if (minutesSinceUpdate > 30) {
      return 'danger'; // No update for 30+ minutes
    } else if (minutesSinceUpdate > 15) {
      return 'warning'; // No update for 15+ minutes
    }

    // Check accuracy
    if (location.accuracy && location.accuracy > 100) {
      return 'warning'; // Poor GPS accuracy
    }

    return 'safe';
  };

  const updatePatientStatus = (location: Location) => {
    const status = determineLocationStatus(location);
    setPatientStatus({
      status,
      lastUpdate: new Date(location.timestamp || Date.now()).toLocaleTimeString(),
      isOnline: true,
      batteryLevel: location.battery_level,
    });

    // Start status animations based on status
    if (status !== 'safe') {
      startStatusAnimation();
    }
  };

  const startStatusAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(statusOpacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(statusOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const checkGeofenceStatus = async (patientId: number, location: Location) => {
    try {
      const response = await apiService.checkGeofences({
        patient_id: patientId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
      });

      if (response.success && response.alerts && response.alerts.length > 0) {
        // Handle geofence alerts
        response.alerts.forEach((alert: any) => {
          handleGeofenceAlert(alert);
        });
      }
    } catch (error) {
      console.error('[RealTimeMapScreen] Error checking geofences:', error);
    }
  };

  const handleGeofenceAlert = (alert: any) => {
    // Show alert notification
    Alert.alert(
      '地理圍欄警報',
      alert.message,
      [
        { text: '確認', onPress: () => console.log('Alert acknowledged') }
      ]
    );

    // Update visual alerts
    setPatientStatus(prev => ({ ...prev, status: 'danger' }));

    // Start alert animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(alertPulse, {
          toValue: 1.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(alertPulse, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '位置權限',
            message: '需要您的位置權限來顯示即時定位',
            buttonNeutral: '稍後詢問',
            buttonNegative: '取消',
            buttonPositive: '確定',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('[RealTimeMapScreen] Location permission granted');
          return true;
        } else {
          console.log('[RealTimeMapScreen] Location permission denied');
          return false;
        }
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const sendEmergencySOS = async () => {
    if (!selectedPatient || !currentLocation) {
      Alert.alert('錯誤', '無法發送緊急求救信號');
      return;
    }

    try {
      const response = await apiService.sendSOS({
        patient_id: selectedPatient.id,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        message: '緊急求救！患者需要立即協助！',
        battery_level: currentLocation.battery_level,
      });

      if (response.success) {
        Alert.alert('緊急求救', '緊急求救信號已發送！');
      }
    } catch (error) {
      console.error('[RealTimeMapScreen] Error sending SOS:', error);
      Alert.alert('錯誤', '發送緊急求救信號失敗');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInitialData();
      if (selectedPatient) {
        await loadPatientData(selectedPatient.id);
      }
    } catch (error) {
      console.error('[RealTimeMapScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [selectedPatient]);

  const getStatusColor = (status: 'safe' | 'warning' | 'danger'): string => {
    switch (status) {
      case 'safe': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'danger': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: 'safe' | 'warning' | 'danger'): string => {
    switch (status) {
      case 'safe': return '安全';
      case 'warning': return '注意';
      case 'danger': return '危險';
      default: return '未知';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>載入即時定位資料...</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={styles.offlineContainer}>
        <Text style={styles.offlineText}>無網路連線</Text>
        <Text style={styles.offlineSubtext}>請檢查您的網路設定</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeScreen}>
          <Text style={styles.retryButtonText}>重試</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#4A90E2" barStyle="light-content" />

      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={currentRegion}
        region={currentRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={() => setIsMapReady(true)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Patient Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title={selectedPatient?.name || '患者'}
            description={`最後更新: ${patientStatus.lastUpdate}`}
          >
            <Animated.View style={[
              styles.patientMarker,
              {
                backgroundColor: getStatusColor(patientStatus.status),
                opacity: patientStatus.status === 'safe' ? 1 : statusOpacity,
                transform: [{ scale: patientStatus.status === 'danger' ? alertPulse : 1 }],
              }
            ]}>
              <Text style={styles.markerText}>
                {selectedPatient?.name?.charAt(0) || 'P'}
              </Text>
            </Animated.View>
          </Marker>
        )}

        {/* Location History Path */}
        {patientLocations.length > 1 && (
          <Polyline
            coordinates={patientLocations.map(loc => ({
              latitude: loc.latitude,
              longitude: loc.longitude,
            }))}
            strokeColor="#4A90E2"
            strokeWidth={3}
            strokeOpacity={0.7}
          />
        )}

        {/* Geofences */}
        {geofences.map(geofence => (
          <Circle
            key={geofence.id}
            center={{
              latitude: geofence.center_latitude,
              longitude: geofence.center_longitude,
            }}
            radius={geofence.radius}
            strokeColor="#10B981"
            strokeWidth={2}
            fillColor="rgba(16, 185, 129, 0.1)"
          />
        ))}
      </MapView>

      {/* Status Panel */}
      <View style={styles.statusPanel}>
        <View style={styles.statusHeader}>
          <Text style={styles.patientName}>
            {selectedPatient?.name || '選擇患者'}
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(patientStatus.status) }
          ]}>
            <Text style={styles.statusText}>
              {getStatusText(patientStatus.status)}
            </Text>
          </View>
        </View>

        <View style={styles.statusInfo}>
          <Text style={styles.infoText}>
            最後更新: {patientStatus.lastUpdate}
          </Text>
          {patientStatus.batteryLevel && (
            <Text style={styles.infoText}>
              電池: {patientStatus.batteryLevel}%
            </Text>
          )}
          <Text style={[
            styles.infoText,
            { color: patientStatus.isOnline ? '#10B981' : '#EF4444' }
          ]}>
            {patientStatus.isOnline ? '線上' : '離線'}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlPanel}>
        <TouchableOpacity
          style={[styles.controlButton, styles.sosButton]}
          onPress={sendEmergencySOS}
        >
          <Text style={styles.sosButtonText}>緊急求救</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.navigate('Geofence')}
        >
          <Text style={styles.controlButtonText}>地理圍欄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={onRefresh}
        >
          <Text style={styles.controlButtonText}>刷新</Text>
        </TouchableOpacity>
      </View>

      {/* Patient Selector */}
      {patients.length > 1 && (
        <View style={styles.patientSelector}>
          {patients.map(patient => (
            <TouchableOpacity
              key={patient.id}
              style={[
                styles.patientButton,
                selectedPatient?.id === patient.id && styles.selectedPatientButton
              ]}
              onPress={() => setSelectedPatient(patient)}
            >
              <Text style={[
                styles.patientButtonText,
                selectedPatient?.id === patient.id && styles.selectedPatientButtonText
              ]}>
                {patient.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  offlineText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  offlineSubtext: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  patientMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusPanel: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
  controlPanel: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sosButton: {
    backgroundColor: '#EF4444',
  },
  sosButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  patientSelector: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  patientButton: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  selectedPatientButton: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  patientButtonText: {
    fontSize: 12,
    color: '#666',
  },
  selectedPatientButtonText: {
    color: 'white',
  },
});

export default RealTimeMapScreen;