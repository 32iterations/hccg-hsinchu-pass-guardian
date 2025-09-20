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
  ScrollView,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
  AnimatedRegion,
  MarkerAnimated,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import ApiService from '../services/api';
import SimulationPanel from '../../components/SimulationPanel';
import SimulatedMapView from '../../components/SimulatedMapView';

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: number;
  accuracy?: number;
}

// Animation coordinate type
interface AnimatedLocation extends Location {
  latitudeDelta?: number;
  longitudeDelta?: number;
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
// 新竹火車站正確座標
const DEFAULT_REGION: Region = {
  latitude: 24.8019,  // 新竹火車站緯度
  longitude: 120.9718, // 新竹火車站經度
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const MapScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);
  const markerRef = useRef<any>(null);

  // 動畫座標狀態
  const [animatedCoordinate] = useState(new AnimatedRegion({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  }));

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [patientLocations, setPatientLocations] = useState<PatientLocation[]>([]);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientLocation | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region>(DEFAULT_REGION);
  const [showSimulationPanel, setShowSimulationPanel] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationPath, setSimulationPath] = useState<Location[]>([]);
  const [useSimulatedMap, setUseSimulatedMap] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true);
  const [mapLoadProgress] = useState(new Animated.Value(0));
  const watchIdRef = useRef<number | null>(null);
  const animationInterval = useRef<NodeJS.Timeout | null>(null);

  // 檢查網路連接
  const checkNetworkConnection = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      setIsNetworkAvailable(state.isConnected ?? false);

      if (!state.isConnected) {
        console.log('No network connection, consider using simulated map');
        if (!useSimulatedMap && !isMapReady) {
          Alert.alert(
            '網路連線提示',
            '偵測到網路連線問題，建議使用模擬地圖模式。',
            [
              { text: '使用模擬地圖', onPress: () => setUseSimulatedMap(true) },
              { text: '繼續等待', style: 'cancel' }
            ]
          );
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('Network check error:', error);
      return false;
    }
  }, [useSimulatedMap, isMapReady]);

  useEffect(() => {
    // 網路監聽器
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsNetworkAvailable(state.isConnected ?? false);
    });

    checkNetworkConnection();
    requestLocationPermission();

    return () => {
      unsubscribe();
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
      if (animationInterval.current) {
        clearInterval(animationInterval.current);
      }
    };
  }, [checkNetworkConnection]);

  useEffect(() => {
    if (isMapReady) {
      loadPatientData();
    }
  }, [isMapReady]);

  // 改進的地圖載入邏輯 - 不依賴 onMapReady
  useEffect(() => {
    let mapInitTimer: NodeJS.Timeout;
    let loadingAnimation: Animated.CompositeAnimation;

    if (!useSimulatedMap) {
      console.log('[MapScreen] Starting Google Maps initialization...');

      // 立即嘗試標記地圖為準備就緒（不等待 onMapReady）
      // 因為 MapView 本身可能已經渲染但回調未觸發
      mapInitTimer = setTimeout(() => {
        console.log('[MapScreen] Force setting map ready after 3 seconds');
        setIsMapReady(true);
        setMapLoadError(false);
      }, 3000);

      // 顯示載入進度動畫
      loadingAnimation = Animated.timing(mapLoadProgress, {
        toValue: 100,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      loadingAnimation.start();

      // 超時檢測 - 10秒後提示用戶
      const timeout = setTimeout(() => {
        if (!isMapReady) {
          console.log('[MapScreen] Offering fallback option after 10 seconds');
          Alert.alert(
            '🗺️ Google Maps 載入緩慢',
            '地圖載入時間較長，您可以選擇切換至模擬地圖以獲得更好的體驗。',
            [
              {
                text: '繼續使用 Google Maps',
                onPress: () => {
                  console.log('[MapScreen] User chose to continue with Google Maps');
                  setIsMapReady(true);
                }
              },
              {
                text: '切換模擬地圖',
                onPress: () => {
                  console.log('[MapScreen] User switched to simulated map');
                  setUseSimulatedMap(true);
                  setIsMapReady(true);
                  setMapLoadError(false);
                },
                style: 'cancel'
              }
            ]
          );
        }
      }, 10000);

      return () => {
        clearTimeout(mapInitTimer);
        clearTimeout(timeout);
        if (loadingAnimation) {
          loadingAnimation.stop();
        }
      };
    } else {
      // 模擬地圖立即準備就緒
      setIsMapReady(true);
    }
  }, [useSimulatedMap]);

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

  // 地圖錯誤處理 - 2025年最佳實踐：提供重試選項
  const handleMapError = (error: any) => {
    console.error('Google Maps loading error:', error);
    setMapLoadError(true);
    Alert.alert(
      '🗺️ Google Maps 載入失敗',
      '檢測到 Google Maps 載入問題。您可以選擇重新載入或切換至模擬地圖模式。',
      [
        {
          text: '重新載入',
          onPress: () => {
            setMapLoadError(false);
            setIsMapReady(false);
            setUseSimulatedMap(false);
            // 強制重新渲染 MapView
            setTimeout(() => {
              console.log('Retrying Google Maps load');
            }, 100);
          }
        },
        {
          text: '使用模擬地圖',
          onPress: () => {
            setUseSimulatedMap(true);
          }
        }
      ]
    );
  };

  // 切換地圖類型 - 2025年最佳實踐：智能切換
  const toggleMapType = () => {
    const switchingToGoogle = useSimulatedMap;

    if (switchingToGoogle) {
      // 切換至 Google Maps
      Alert.alert(
        '🌍 切換至 Google Maps',
        '正在載入 Google Maps，這可能需要一些時間。載入期間請保持網路連線。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '確定',
            onPress: () => {
              setUseSimulatedMap(false);
              setIsMapReady(false);
              setMapLoadError(false);
              console.log('Switching to Google Maps');
            }
          }
        ]
      );
    } else {
      // 切換至模擬地圖
      setUseSimulatedMap(true);
      Alert.alert(
        '🗺️ 切換至模擬地圖',
        '已切換至模擬地圖模式。所有功能仍可正常使用，位置模擬功能將更加準確。',
        [{ text: '確定' }]
      );
    }
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

  // 改進的載入指示器 - 僅在初始載入時顯示
  if (!useSimulatedMap && !isMapReady && !mapLoadError && isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.googleMapsLoadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.googleMapsLoadingText}>正在初始化地圖...</Text>
          <Text style={styles.googleMapsLoadingSubtext}>
            請稍候片刻
          </Text>
          <TouchableOpacity
            style={styles.switchToSimulatedButton}
            onPress={() => {
              console.log('[MapScreen] User manually switched to simulated map');
              setUseSimulatedMap(true);
              setIsMapReady(true);
            }}
          >
            <Text style={styles.switchToSimulatedButtonText}>立即使用模擬地圖</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 地圖視圖 - 支援 Google Maps 和模擬地圖 */}
      {useSimulatedMap ? (
        <SimulatedMapView
          region={currentRegion}
          onRegionChange={setCurrentRegion}
          onRegionChangeComplete={(region) => {
            setCurrentRegion(region);
          }}
          onMapReady={() => {
            console.log('Simulated map ready');
            setIsMapReady(true);
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          style={styles.map}
        />
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : DEFAULT_REGION}
          region={currentRegion}
          onMapReady={() => {
            console.log('[MapScreen] Google Maps onMapReady callback fired');
            setIsMapReady(true);
            setMapLoadError(false);
          }}
          onMapLoaded={() => {
            console.log('[MapScreen] Google Maps onMapLoaded callback fired');
            setIsMapReady(true);
          }}
          onError={(error) => {
            console.error('[MapScreen] Google Maps error:', error);
            handleMapError(error);
          }}
          onRegionChangeComplete={(region) => {
            setCurrentRegion(region);
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
          loadingEnabled={true}
          loadingIndicatorColor="#667eea"
          loadingBackgroundColor="#F5F5F5"
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

        {/* Simulation path */}
        {isMapReady && isSimulating && simulationPath.length > 1 && (
          <Polyline
            coordinates={simulationPath}
            strokeColor="#FF6B6B"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        )}
        </MapView>
      )}

      {/* 地圖切換按鈕 */}
      <TouchableOpacity
        style={styles.mapToggleButton}
        onPress={toggleMapType}
      >
        <Text style={styles.mapToggleText}>
          {useSimulatedMap ? '🗺️ 模擬地圖' : '🌍 Google Maps'}
        </Text>
      </TouchableOpacity>

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

        <TouchableOpacity
          style={[styles.controlButton, styles.simulationButton]}
          onPress={() => setShowSimulationPanel(!showSimulationPanel)}>
          <Text style={styles.controlButtonText}>模擬</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.mapSwitchButton]}
          onPress={toggleMapType}>
          <Text style={styles.controlButtonText}>
            {useSimulatedMap ? '實景地圖' : '模擬地圖'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Simulation Panel Modal */}
      <Modal
        visible={showSimulationPanel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSimulationPanel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSimulationPanel(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <SimulationPanel
              onSimulationStart={(simulationId) => {
                setIsSimulating(true);
                console.log('Simulation started:', simulationId);
              }}
              onSimulationStop={() => {
                setIsSimulating(false);
                setSimulationPath([]);
              }}
              onLocationUpdate={(location) => {
                if (location && location.latitude && location.longitude) {
                  const newLocation = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    timestamp: Date.now(),
                  };
                  setCurrentLocation(newLocation);
                  setSimulationPath(prev => [...prev, newLocation]);

                  // 更新地圖視角
                  if (mapRef.current) {
                    mapRef.current.animateToRegion({
                      latitude: location.latitude,
                      longitude: location.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }, 500);
                  }
                }
              }}
              isSimulating={isSimulating}
            />
          </View>
        </View>
      </Modal>

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
  simulationButton: {
    backgroundColor: '#FF6B6B',
  },
  mapSwitchButton: {
    backgroundColor: '#2196F3',
  },
  mapToggleButton: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mapToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    zIndex: 1,
    padding: 10,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#999',
    fontWeight: 'bold',
  },
  // Google Maps 載入指示器樣式 - 2025年最佳實踐
  googleMapsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  googleMapsLoadingText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  googleMapsLoadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  switchToSimulatedButton: {
    marginTop: 25,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  switchToSimulatedButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MapScreen;