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
  PROVIDER_DEFAULT,
  Region,
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

// CRITICAL: Default region to prevent crashes
const DEFAULT_REGION: Region = {
  latitude: 24.8066,
  longitude: 120.9686,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const MapScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [patientLocations, setPatientLocations] = useState<PatientLocation[]>([]);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientLocation | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region>(DEFAULT_REGION);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMapReady) {
      loadPatientData();
    }
  }, [isMapReady]);

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
        } else {
          // Even if permission denied, still show map with default location
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Permission error:', err);
        setIsLoading(false);
      }
    } else {
      getCurrentLocation();
    }
  };

  const getCurrentLocation = () => {
    // Check if Geolocation is available and has the correct method
    if (!Geolocation || !Geolocation.getCurrentPosition) {
      console.warn('Geolocation service not available');
      setIsLoading(false);
      return;
    }

    try {
      Geolocation.getCurrentPosition(
        (position) => {
          if (position && position.coords) {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
              accuracy: position.coords.accuracy,
            };
            setCurrentLocation(location);

            // Update region only if map is ready
            if (isMapReady && mapRef.current) {
              const newRegion: Region = {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              };
              setCurrentRegion(newRegion);
              mapRef.current.animateToRegion(newRegion, 1000);
            }
          }
          setIsLoading(false);
        },
        (error) => {
          console.log('Location error:', error);
          // Use default location on error - still show the map
          setCurrentLocation({
            latitude: DEFAULT_REGION.latitude,
            longitude: DEFAULT_REGION.longitude,
            timestamp: Date.now(),
            accuracy: 100,
          });
          setIsLoading(false);
        },
        {
          enableHighAccuracy: false, // Changed to false to prevent crashes
          timeout: 20000,
          maximumAge: 10000,
          forceRequestLocation: false,
        }
      );
    } catch (error) {
      console.error('Failed to get location:', error);
      // Fallback to default location
      setCurrentLocation({
        latitude: DEFAULT_REGION.latitude,
        longitude: DEFAULT_REGION.longitude,
        timestamp: Date.now(),
        accuracy: 100,
      });
      setIsLoading(false);
    }
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
        setLocationHistory(prev => [...prev, location].slice(-100));

        // Update location to backend
        if (selectedPatient && location.latitude && location.longitude) {
          ApiService.updateLocation(
            selectedPatient.id,
            location.latitude,
            location.longitude,
            'gps'
          ).catch(error => {
            console.warn('Failed to update location:', error);
          });
        }

        // Check geofence violations
        checkGeofenceViolation(location);
      },
      (error) => {
        console.log('Tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
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
      } catch (error) {
        console.warn('Failed to load patients:', error);
      }

      // Load geofences
      try {
        const geofencesResult = await ApiService.getGeofences();
        if (geofencesResult.success && geofencesResult.geofences && Array.isArray(geofencesResult.geofences)) {
          const validGeofences: Geofence[] = geofencesResult.geofences
            .filter((g: any) =>
              g &&
              typeof g.center_lat === 'number' &&
              typeof g.center_lng === 'number' &&
              g.center_lat >= -90 && g.center_lat <= 90 &&
              g.center_lng >= -180 && g.center_lng <= 180
            )
            .map((g: any) => ({
              id: g.id || String(Math.random()),
              name: g.name || '未命名圍欄',
              center: {
                latitude: g.center_lat,
                longitude: g.center_lng,
              },
              radius: Number(g.radius) || 100,
              active: g.active || g.is_active || false,
            }));
          setGeofences(validGeofences);
        }
      } catch (error) {
        console.warn('Failed to load geofences:', error);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
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
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const createGeofence = () => {
    if (!currentLocation) {
      Alert.alert('錯誤', '請先取得您的位置');
      return;
    }

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
                radius: 100,
              });

              if (result.success) {
                loadPatientData();
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

  // Show loading screen while initializing
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
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : DEFAULT_REGION}
        region={currentRegion}
        onMapReady={() => {
          console.log('Map is ready');
          setIsMapReady(true);
        }}
        onRegionChangeComplete={(region) => {
          setCurrentRegion(region);
        }}
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
        {isMapReady && patientLocations.map(patient => (
          <Marker
            key={patient.id}
            coordinate={patient.location}
            title={patient.name}
            description={`最後更新: ${new Date(patient.last_update).toLocaleTimeString()}`}
            pinColor={getMarkerColor(patient.status)}
            onPress={() => setSelectedPatient(patient)}
          />
        ))}

        {/* Geofences - Only render when map is ready and data is valid */}
        {isMapReady && geofences
          .filter(fence =>
            fence.active &&
            fence.center &&
            !isNaN(fence.center.latitude) &&
            !isNaN(fence.center.longitude)
          )
          .map(fence => (
            <Circle
              key={fence.id}
              center={{
                latitude: fence.center.latitude,
                longitude: fence.center.longitude
              }}
              radius={fence.radius}
              fillColor="rgba(102, 126, 234, 0.2)"
              strokeColor="rgba(102, 126, 234, 0.5)"
              strokeWidth={2}
            />
          ))}

        {/* Location history path */}
        {isMapReady && locationHistory.length > 1 && (
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