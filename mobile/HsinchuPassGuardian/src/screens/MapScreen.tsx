import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  ScrollView,
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import ApiService from '../services/api';

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: number;
  accuracy?: number;
}

interface Geofence {
  id: string;
  name: string;
  center: Location;
  radius: number;
  active: boolean;
}

interface PatientLocation {
  id: string;
  name: string;
  location: Location;
  beacon_id?: string;
  last_update: string;
  status: 'safe' | 'warning' | 'danger';
}

const MapScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [patientLocations, setPatientLocations] = useState<PatientLocation[]>([]);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Default to Hsinchu City Hall
  const defaultRegion = {
    latitude: 24.8066,
    longitude: 120.9686,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    requestLocationPermission();
    loadPatientData();

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '位置權限',
            message: '需要您的位置權限來顯示地圖',
            buttonNeutral: '稍後詢問',
            buttonNegative: '取消',
            buttonPositive: '確定',
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getCurrentLocation();
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      getCurrentLocation();
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy,
        };
        setCurrentLocation(location);
        setIsLoading(false);

        // Center map on current location
        mapRef.current?.animateToRegion({
          ...location,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      },
      (error) => {
        console.log('Location error:', error);
        setIsLoading(false);
        Alert.alert('無法取得位置', '請確認GPS已開啟');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const startLocationTracking = () => {
    if (isTracking) {
      stopLocationTracking();
      return;
    }

    setIsTracking(true);

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy,
        };

        setCurrentLocation(location);
        setLocationHistory(prev => [...prev, location].slice(-100)); // Keep last 100 points

        // Update location to backend
        if (selectedPatient) {
          ApiService.updateLocation(
            selectedPatient.id,
            location.latitude,
            location.longitude,
            'gps'
          );
        }

        // Check geofence violations
        checkGeofenceViolation(location);
      },
      (error) => {
        console.log('Tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: 5000, // Update every 5 seconds
        fastestInterval: 2000,
      }
    );
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  const loadPatientData = async () => {
    try {
      // Load patients
      try {
        const patientsResult = await ApiService.getPatients();
        if (patientsResult.success && patientsResult.patients) {
          // Mock patient locations for demo
          const mockPatients: PatientLocation[] = patientsResult.patients.map((p: any) => ({
            id: p.id,
            name: p.name,
            location: {
              latitude: 24.8066 + (Math.random() - 0.5) * 0.01,
              longitude: 120.9686 + (Math.random() - 0.5) * 0.01,
            },
            beacon_id: p.beacon_id,
            last_update: new Date().toISOString(),
            status: 'safe' as const,
          }));
          setPatientLocations(mockPatients);
        }
      } catch (patientsError) {
        console.warn('Failed to load patients:', patientsError);
        // Continue without patient data
      }

      // Load geofences
      if (route.params?.patientId) {
        try {
          const geofencesResult = await ApiService.getGeofences(route.params.patientId);
          if (geofencesResult.success && geofencesResult.geofences) {
            const fences: Geofence[] = geofencesResult.geofences.map((g: any) => ({
              id: g.id,
              name: g.name,
              center: {
                latitude: g.center_lat || g.center?.latitude,
                longitude: g.center_lng || g.center?.longitude,
              },
              radius: g.radius,
              active: g.active || g.is_active,
            }));
            setGeofences(fences);
          }
        } catch (geofenceError) {
          console.warn('Failed to load geofences:', geofenceError);
          // Continue without geofence data
        }
      }

      // Load location history if patient selected
      if (route.params?.patientId) {
        try {
          const historyResult = await ApiService.getLocationHistory(route.params.patientId, 24);
          if (historyResult.success && historyResult.locations) {
            const history: Location[] = historyResult.locations.map((l: any) => ({
              latitude: l.latitude,
              longitude: l.longitude,
              timestamp: new Date(l.timestamp).getTime(),
            }));
            setLocationHistory(history);
          }
        } catch (historyError) {
          console.warn('Failed to load location history:', historyError);
          // Continue without location history
        }
      }
    } catch (error) {
      console.error('Failed to load patient data:', error);
      // App should still work even if some data fails to load
    }
  };

  const checkGeofenceViolation = (location: Location) => {
    geofences.forEach(fence => {
      if (fence.active) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          fence.center.latitude,
          fence.center.longitude
        );

        if (distance > fence.radius) {
          Alert.alert(
            '⚠️ 地理圍欄警報',
            `患者已離開安全區域「${fence.name}」`,
            [{ text: '確定' }]
          );
        }
      }
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const createGeofence = () => {
    if (!currentLocation) {
      Alert.alert('錯誤', '請先取得您的位置');
      return;
    }

    // Android doesn't have Alert.prompt, use a simple alert instead
    Alert.alert(
      '建立地理圍欄',
      '將在目前位置建立100公尺的安全圍欄',
      [
        {
          text: '取消',
          style: 'cancel'
        },
        {
          text: '確定',
          onPress: async () => {
            if (selectedPatient) {
              const result = await ApiService.createGeofence({
                patient_id: selectedPatient.id,
                name: `安全區域 ${new Date().toLocaleDateString()}`,
                center_lat: currentLocation.latitude,
                center_lng: currentLocation.longitude,
                radius: 100, // Default 100 meters
              });

              if (result.success) {
                loadPatientData(); // Reload geofences
                Alert.alert('成功', '地理圍欄已建立');
              }
            } else {
              Alert.alert('提示', '請先選擇要監護的對象');
            }
          }
        }
      ]
    );
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'safe': return '#4CAF50';
      case 'warning': return '#FFC107';
      case 'danger': return '#F44336';
      default: return '#2196F3';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>載入地圖中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={currentLocation ? {
          ...currentLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : defaultRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
      >
        {/* Current location marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="我的位置"
            description="目前位置"
            pinColor="#667eea"
          />
        )}

        {/* Patient locations */}
        {patientLocations.map(patient => (
          <Marker
            key={patient.id}
            coordinate={patient.location}
            title={patient.name}
            description={`最後更新: ${new Date(patient.last_update).toLocaleTimeString()}`}
            pinColor={getMarkerColor(patient.status)}
            onPress={() => setSelectedPatient(patient)}
          />
        ))}

        {/* Geofences */}
        {geofences.map(fence => fence.active && (
          <Circle
            key={fence.id}
            center={fence.center}
            radius={fence.radius}
            fillColor="rgba(102, 126, 234, 0.2)"
            strokeColor="rgba(102, 126, 234, 0.5)"
            strokeWidth={2}
          />
        ))}

        {/* Location history path */}
        {locationHistory.length > 1 && (
          <Polyline
            coordinates={locationHistory}
            strokeColor="#667eea"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Control panel */}
      <View style={styles.controlPanel}>
        <TouchableOpacity
          style={[styles.controlButton, isTracking && styles.activeButton]}
          onPress={startLocationTracking}>
          <Text style={styles.controlButtonText}>
            {isTracking ? '停止追蹤' : '開始追蹤'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={getCurrentLocation}>
          <Text style={styles.controlButtonText}>定位</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={createGeofence}>
          <Text style={styles.controlButtonText}>設定圍欄</Text>
        </TouchableOpacity>
      </View>

      {/* Patient info panel */}
      {selectedPatient && (
        <View style={styles.infoPanel}>
          <Text style={styles.infoPanelTitle}>{selectedPatient.name}</Text>
          <Text style={styles.infoPanelText}>
            狀態: {selectedPatient.status === 'safe' ? '安全' : '警報'}
          </Text>
          <Text style={styles.infoPanelText}>
            信標ID: {selectedPatient.beacon_id || '未配對'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedPatient(null)}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  controlPanel: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    elevation: 5,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  controlButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  activeButton: {
    backgroundColor: '#764ba2',
  },
  controlButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    elevation: 5,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  infoPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  infoPanelText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#999',
  },
});

export default MapScreen;