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
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
  AnimatedRegion,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import ApiService from '../services/api';

const { width, height } = Dimensions.get('window');

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: number;
  accuracy?: number;
}

interface PatientStatus {
  status: 'safe' | 'warning' | 'danger';
  lastUpdate: string;
  isWandering: boolean;
}

// 新竹地區預設座標 - 火車站
const DEFAULT_REGION: Region = {
  latitude: 24.8113,
  longitude: 120.9715,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// 模擬路徑資料
const SIMULATION_DATA = {
  homeCoords: { latitude: 24.8113, longitude: 120.9715 },
  destinationCoords: { latitude: 24.8035, longitude: 120.9920 },
  normalPath: [
    { latitude: 24.8113, longitude: 120.9715 },
    { latitude: 24.8110, longitude: 120.9725 },
    { latitude: 24.8105, longitude: 120.9740 },
    { latitude: 24.8090, longitude: 120.9750 },
    { latitude: 24.8085, longitude: 120.9775 },
    { latitude: 24.8078, longitude: 120.9800 },
    { latitude: 24.8070, longitude: 120.9820 }, // 偏離點
    { latitude: 24.8065, longitude: 120.9845 },
    { latitude: 24.8055, longitude: 120.9870 },
    { latitude: 24.8045, longitude: 120.9895 },
    { latitude: 24.8035, longitude: 120.9920 },
  ],
  wanderingPath: [
    { latitude: 24.8070, longitude: 120.9820 },
    { latitude: 24.8072, longitude: 120.9825 },
    { latitude: 24.8068, longitude: 120.9828 },
    { latitude: 24.8071, longitude: 120.9823 },
    { latitude: 24.8073, longitude: 120.9826 },
    { latitude: 24.8069, longitude: 120.9829 },
    { latitude: 24.8070, longitude: 120.9821 },
  ],
  deviationPointIndex: 6,
};

const EnhancedMapScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);
  const animationRef = useRef<any>(null);
  const [patientName] = useState('陳秀英');

  // 地圖狀態
  const [currentLocation, setCurrentLocation] = useState<Location>(SIMULATION_DATA.homeCoords);
  const [currentRegion, setCurrentRegion] = useState<Region>(DEFAULT_REGION);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 患者追蹤狀態
  const [patientStatus, setPatientStatus] = useState<PatientStatus>({
    status: 'safe',
    lastUpdate: new Date().toLocaleTimeString(),
    isWandering: false,
  });

  // 模擬狀態
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [pathHistory, setPathHistory] = useState<Location[]>([]);
  const [predictionPath, setPredictionPath] = useState<Location[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertLocation, setAlertLocation] = useState<Location | null>(null);

  // 動畫值
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const alertPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeMap();
    requestLocationPermission();

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  // 地圖初始化
  const initializeMap = () => {
    console.log('[EnhancedMapScreen] Initializing map...');

    // 強制設置地圖準備就緒（解決 Google Maps 載入問題）
    setTimeout(() => {
      if (!isMapReady) {
        console.log('[EnhancedMapScreen] Force setting map ready');
        setIsMapReady(true);
        setIsLoading(false);
      }
    }, 1500);
  };

  // 請求位置權限
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
          console.log('[EnhancedMapScreen] Location permission granted');
        }
      } catch (err) {
        console.warn('Permission error:', err);
      }
    }
    setIsLoading(false);
  };

  // 開始模擬
  const startSimulation = useCallback(() => {
    console.log('[EnhancedMapScreen] Starting simulation...');

    if (isSimulating) {
      stopSimulation();
      return;
    }

    setIsSimulating(true);
    setSimulationProgress(0);
    setPathHistory([SIMULATION_DATA.homeCoords]);
    setCurrentLocation(SIMULATION_DATA.homeCoords);
    setPatientStatus({
      status: 'safe',
      lastUpdate: new Date().toLocaleTimeString(),
      isWandering: false,
    });
    setShowAlert(false);
    setAlertLocation(null);

    let currentIndex = 0;
    let isInWanderingPhase = false;
    let wanderingIndex = 0;

    const simulationInterval = setInterval(() => {
      const now = new Date();

      if (!isInWanderingPhase) {
        // 正常路徑階段
        if (currentIndex < SIMULATION_DATA.normalPath.length - 1) {
          if (currentIndex === SIMULATION_DATA.deviationPointIndex) {
            // 到達偏離點，開始徘徊
            isInWanderingPhase = true;
            console.log('[Simulation] Starting wandering phase...');

            // 3秒後顯示警告
            setTimeout(() => {
              if (isSimulating) {
                setPatientStatus(prev => ({
                  ...prev,
                  status: 'warning',
                  isWandering: true,
                  lastUpdate: new Date().toLocaleTimeString(),
                }));

                // 開始狀態指示器閃爍動畫
                Animated.loop(
                  Animated.sequence([
                    Animated.timing(statusOpacity, {
                      toValue: 0.3,
                      duration: 500,
                      useNativeDriver: true,
                    }),
                    Animated.timing(statusOpacity, {
                      toValue: 1,
                      duration: 500,
                      useNativeDriver: true,
                    }),
                  ])
                ).start();
              }
            }, 3000);

            // 6秒後顯示危險警報
            setTimeout(() => {
              if (isSimulating) {
                setPatientStatus(prev => ({
                  ...prev,
                  status: 'danger',
                  lastUpdate: new Date().toLocaleTimeString(),
                }));

                setShowAlert(true);
                setAlertLocation(SIMULATION_DATA.wanderingPath[0]);

                // 警報脈衝動畫
                Animated.loop(
                  Animated.sequence([
                    Animated.timing(alertPulse, {
                      toValue: 1.3,
                      duration: 600,
                      useNativeDriver: true,
                    }),
                    Animated.timing(alertPulse, {
                      toValue: 1,
                      duration: 600,
                      useNativeDriver: true,
                    }),
                  ])
                ).start();

                Alert.alert(
                  '🚨 系統警報',
                  `偵測到 ${patientName} 出現異常行走模式！\n\n建議立即聯繫患者或前往現場確認安全狀況。`,
                  [
                    { text: '查看位置', onPress: () => centerOnPatient() },
                    { text: '確定', style: 'default' }
                  ]
                );
              }
            }, 6000);

            return;
          }

          currentIndex++;
          const newLocation = SIMULATION_DATA.normalPath[currentIndex];
          setCurrentLocation(newLocation);
          setPathHistory(prev => [...prev, newLocation]);

          // 預測路徑
          if (currentIndex < SIMULATION_DATA.normalPath.length - 2) {
            setPredictionPath([
              newLocation,
              SIMULATION_DATA.normalPath[currentIndex + 1]
            ]);
          }
        }
      } else {
        // 徘徊階段
        if (wanderingIndex < SIMULATION_DATA.wanderingPath.length - 1) {
          wanderingIndex++;
          const newLocation = SIMULATION_DATA.wanderingPath[wanderingIndex];
          setCurrentLocation(newLocation);
          setPathHistory(prev => [...prev, newLocation]);
        } else {
          // 模擬結束
          stopSimulation();
          return;
        }
      }

      // 更新最後更新時間
      setPatientStatus(prev => ({
        ...prev,
        lastUpdate: now.toLocaleTimeString(),
      }));

      // 更新進度
      const totalSteps = SIMULATION_DATA.normalPath.length + SIMULATION_DATA.wanderingPath.length;
      const currentStep = currentIndex + (isInWanderingPhase ? wanderingIndex : 0);
      setSimulationProgress(Math.min((currentStep / totalSteps) * 100, 100));

    }, 2000); // 每2秒更新一次位置

    animationRef.current = simulationInterval;
  }, [isSimulating, patientName]);

  // 停止模擬
  const stopSimulation = useCallback(() => {
    console.log('[EnhancedMapScreen] Stopping simulation...');

    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    setIsSimulating(false);
    setSimulationProgress(0);
    statusOpacity.stopAnimation();
    alertPulse.stopAnimation();
    statusOpacity.setValue(1);
    alertPulse.setValue(1);

    // 重置狀態
    setPatientStatus({
      status: 'safe',
      lastUpdate: new Date().toLocaleTimeString(),
      isWandering: false,
    });
    setShowAlert(false);
    setAlertLocation(null);
  }, []);

  // 置中患者位置
  const centerOnPatient = useCallback(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  }, [currentLocation]);

  // 獲取狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'danger': return '#F44336';
      default: return '#4CAF50';
    }
  };

  // 獲取狀態文字
  const getStatusText = (status: string) => {
    switch (status) {
      case 'safe': return '監控中';
      case 'warning': return '注意';
      case 'danger': return '警報';
      default: return '監控中';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>正在初始化地圖...</Text>
        <Text style={styles.loadingSubtext}>首次載入可能需要較長時間，請耐心等待</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* 地圖視圖 */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onMapReady={() => {
          console.log('[EnhancedMapScreen] Map ready');
          setIsMapReady(true);
        }}
        onRegionChangeComplete={(region) => {
          setCurrentRegion(region);
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        loadingEnabled={Platform.OS === 'ios'}
        loadingIndicatorColor="#667eea"
        loadingBackgroundColor="#F5F5F5"
      >
        {/* 家/起點標記 */}
        <Marker
          coordinate={SIMULATION_DATA.homeCoords}
          title="家 (起點)"
          description="患者居住地"
        >
          <View style={styles.homeMarker}>
            <Text style={styles.markerIcon}>🏠</Text>
          </View>
        </Marker>

        {/* 目的地標記 */}
        <Marker
          coordinate={SIMULATION_DATA.destinationCoords}
          title="失智據點 (目的地)"
          description="日間照護中心"
        >
          <View style={styles.destinationMarker}>
            <Text style={styles.markerIcon}>🎯</Text>
          </View>
        </Marker>

        {/* 患者當前位置 */}
        <Marker
          coordinate={currentLocation}
          title={`${patientName} 的位置`}
          description={`狀態: ${getStatusText(patientStatus.status)}`}
        >
          <Animated.View style={[
            styles.patientMarker,
            {
              backgroundColor: getStatusColor(patientStatus.status),
              opacity: patientStatus.status === 'safe' ? 1 : statusOpacity,
            }
          ]} />
        </Marker>

        {/* 預期路徑 (虛線) */}
        {!patientStatus.isWandering && (
          <Polyline
            coordinates={SIMULATION_DATA.normalPath}
            strokeColor="rgba(100, 100, 100, 0.6)"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* 實際行走路徑 */}
        {pathHistory.length > 1 && (
          <Polyline
            coordinates={pathHistory}
            strokeColor={patientStatus.isWandering ? '#FF9800' : '#4CAF50'}
            strokeWidth={4}
          />
        )}

        {/* 路徑預測 (多重線條模擬機率帶) */}
        {!patientStatus.isWandering && predictionPath.length > 1 && (
          <>
            {/* 外層機率帶 */}
            <Polyline
              coordinates={predictionPath}
              strokeColor="rgba(76, 175, 80, 0.2)"
              strokeWidth={20}
            />
            <Polyline
              coordinates={predictionPath}
              strokeColor="rgba(76, 175, 80, 0.4)"
              strokeWidth={15}
            />
            <Polyline
              coordinates={predictionPath}
              strokeColor="rgba(76, 175, 80, 0.6)"
              strokeWidth={10}
            />
            {/* 中心線 */}
            <Polyline
              coordinates={predictionPath}
              strokeColor="#4CAF50"
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          </>
        )}

        {/* 警報標記 */}
        {showAlert && alertLocation && (
          <Marker coordinate={alertLocation}>
            <Animated.View style={[
              styles.alertMarker,
              { transform: [{ scale: alertPulse }] }
            ]}>
              <Text style={styles.alertIcon}>⚠️</Text>
            </Animated.View>
          </Marker>
        )}
      </MapView>

      {/* 浮動頂部導航列 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          即時定位：<Text style={styles.patientName}>{patientName}</Text>
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* 浮動底部控制面板 */}
      <View style={styles.bottomPanel}>
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <Text style={styles.statusTitle}>{getStatusText(patientStatus.status)}</Text>
            <Animated.View style={[
              styles.statusIndicator,
              {
                backgroundColor: getStatusColor(patientStatus.status),
                opacity: patientStatus.status === 'safe' ? 1 : statusOpacity,
              }
            ]} />
          </View>
          <Text style={styles.lastUpdate}>
            最後更新：{patientStatus.lastUpdate}
          </Text>
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnPatient}
          >
            <Text style={styles.controlIcon}>📍</Text>
            <Text style={styles.controlText}>置中</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              Alert.alert(
                '📞 緊急聯絡',
                `撥打給 ${patientName} 或緊急聯絡人？`,
                [
                  { text: '取消', style: 'cancel' },
                  { text: '撥打電話', onPress: () => console.log('Making call...') }
                ]
              );
            }}
          >
            <Text style={styles.controlIcon}>📞</Text>
            <Text style={styles.controlText}>通話</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.simulationButton,
              isSimulating && styles.activeButton
            ]}
            onPress={startSimulation}
          >
            <Text style={styles.controlIcon}>
              {isSimulating ? '⏹️' : '▶️'}
            </Text>
            <Text style={styles.controlText}>
              {isSimulating ? '停止' : '模擬'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 模擬進度指示器 */}
      {isSimulating && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${simulationProgress}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            模擬進度: {Math.round(simulationProgress)}%
          </Text>
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
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  patientName: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  placeholder: {
    width: 32,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 30,
    left: 15,
    right: 15,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  statusSection: {
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#666',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 70,
  },
  simulationButton: {
    backgroundColor: '#667eea',
  },
  activeButton: {
    backgroundColor: '#F44336',
  },
  controlIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  controlText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    position: 'absolute',
    top: 100,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // 標記樣式
  homeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  patientMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  alertMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  markerIcon: {
    fontSize: 16,
  },
  alertIcon: {
    fontSize: 20,
  },
});

export default EnhancedMapScreen;