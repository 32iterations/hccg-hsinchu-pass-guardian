import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  PermissionsAndroid,
  StatusBar,
  Dimensions,
  Modal,
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import ApiService from '../services/api';

const { width, height } = Dimensions.get('window');

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
  icon: string;
}

interface SmartRecommendation {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  category: 'park' | 'hospital' | 'market' | 'community';
  icon: string;
  color: string;
}

// 新竹地區智慧推薦地點
const SMART_RECOMMENDATIONS: SmartRecommendation[] = [
  {
    name: '新竹公園',
    latitude: 24.8049,
    longitude: 120.9719,
    radius: 300,
    category: 'park',
    icon: '🌳',
    color: '#10B981',
  },
  {
    name: '竹蓮市場',
    latitude: 24.7981,
    longitude: 120.9701,
    radius: 200,
    category: 'market',
    icon: '🛒',
    color: '#F59E0B',
  },
  {
    name: '台大醫院',
    latitude: 24.8143,
    longitude: 120.9723,
    radius: 250,
    category: 'hospital',
    icon: '🏥',
    color: '#3B82F6',
  },
  {
    name: '城隍廟',
    latitude: 24.8032,
    longitude: 120.9673,
    radius: 150,
    category: 'community',
    icon: '🏛️',
    color: '#8B5CF6',
  },
  {
    name: '東門市場',
    latitude: 24.8076,
    longitude: 120.9735,
    radius: 200,
    category: 'market',
    icon: '🥬',
    color: '#F59E0B',
  },
  {
    name: '新竹火車站',
    latitude: 24.8019,
    longitude: 120.9718,
    radius: 400,
    category: 'community',
    icon: '🚉',
    color: '#6B7280',
  },
];

// 預設區域 - 陳秀英家
const DEFAULT_REGION: Region = {
  latitude: 24.8088,
  longitude: 120.9718,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const EnhancedGeofenceScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);
  const [patientName] = useState('陳秀英');

  // 地圖和圍欄狀態
  const [currentRegion, setCurrentRegion] = useState<Region>(DEFAULT_REGION);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number} | null>(null);

  // UI狀態
  const [showAddModal, setShowAddModal] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [isAddingGeofence, setIsAddingGeofence] = useState(false);

  useEffect(() => {
    initializeGeofences();
    requestLocationPermission();
  }, []);

  // 初始化預設圍欄
  const initializeGeofences = () => {
    const defaultGeofences: Geofence[] = [
      {
        id: 'home',
        name: '家',
        latitude: 24.8088,
        longitude: 120.9718,
        radius: 200,
        isActive: true,
        icon: '🏠',
      },
    ];
    setGeofences(defaultGeofences);
  };

  // 請求位置權限
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '位置權限',
            message: '需要您的位置權限來設定地理圍欄',
            buttonNeutral: '稍後詢問',
            buttonNegative: '取消',
            buttonPositive: '確定',
          }
        );
        console.log('[GeofenceScreen] Location permission:', granted);
      } catch (err) {
        console.warn('Permission error:', err);
      }
    }
  };

  // 新增圍欄
  const addGeofence = useCallback(async (recommendation: SmartRecommendation) => {
    try {
      const newGeofence: Geofence = {
        id: `geofence_${Date.now()}`,
        name: recommendation.name,
        latitude: recommendation.latitude,
        longitude: recommendation.longitude,
        radius: recommendation.radius,
        isActive: true,
        icon: recommendation.icon,
      };

      // 先更新本地狀態
      setGeofences(prev => [...prev, newGeofence]);

      // 移動地圖到新位置
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: recommendation.latitude,
          longitude: recommendation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }

      // 嘗試保存到後端
      try {
        const result = await ApiService.createGeofence({
          patient_id: 'current_patient', // 應該從上下文獲取
          name: recommendation.name,
          center_lat: recommendation.latitude,
          center_lng: recommendation.longitude,
          radius: recommendation.radius,
        });

        if (result.success) {
          console.log('[GeofenceScreen] Geofence saved to backend');
        }
      } catch (error) {
        console.warn('[GeofenceScreen] Failed to save geofence to backend:', error);
      }

      Alert.alert(
        '✅ 圍欄設定完成',
        `已為 ${patientName} 新增「${recommendation.name}」安全區域（半徑 ${recommendation.radius} 公尺）`,
        [{ text: '確定' }]
      );

    } catch (error) {
      console.error('[GeofenceScreen] Error adding geofence:', error);
      Alert.alert('錯誤', '新增圍欄時發生錯誤，請稍後再試');
    }
  }, [patientName]);

  // 移除圍欄
  const removeGeofence = useCallback((geofenceId: string) => {
    const geofence = geofences.find(g => g.id === geofenceId);
    if (!geofence) return;

    Alert.alert(
      '確認移除',
      `確定要移除「${geofence.name}」安全區域嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '移除',
          style: 'destructive',
          onPress: () => {
            setGeofences(prev => prev.filter(g => g.id !== geofenceId));

            // 從後端移除
            ApiService.deleteGeofence(geofenceId).catch(error => {
              console.warn('[GeofenceScreen] Failed to delete geofence from backend:', error);
            });
          }
        }
      ]
    );
  }, [geofences]);

  // 新增自訂圍欄
  const addCustomGeofence = useCallback(() => {
    if (!selectedLocation) {
      Alert.alert('提示', '請先在地圖上點選位置或輸入地址');
      return;
    }

    if (!customAddress.trim()) {
      Alert.alert('提示', '請輸入地點名稱');
      return;
    }

    const customGeofence: Geofence = {
      id: `custom_${Date.now()}`,
      name: customAddress.trim(),
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      radius: 200, // 預設半徑
      isActive: true,
      icon: '📍',
    };

    setGeofences(prev => [...prev, customGeofence]);
    setCustomAddress('');
    setSelectedLocation(null);
    setShowAddModal(false);

    // 移動地圖到新位置
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }

    Alert.alert(
      '✅ 自訂圍欄完成',
      `已新增「${customAddress.trim()}」安全區域`,
      [{ text: '確定' }]
    );
  }, [selectedLocation, customAddress]);

  // 地圖點擊處理
  const handleMapPress = useCallback((event: any) => {
    if (isAddingGeofence) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setSelectedLocation({ latitude, longitude });
      setCustomAddress(`座標: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      setShowAddModal(true);
      setIsAddingGeofence(false);
    }
  }, [isAddingGeofence]);

  // 獲取圍欄顏色
  const getGeofenceColor = (name: string) => {
    if (name === '家') return '#10B981';
    const recommendation = SMART_RECOMMENDATIONS.find(r => r.name === name);
    return recommendation?.color || '#8B5CF6';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8B5CF6" />

      {/* 地圖視圖 */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onMapReady={() => {
          console.log('[GeofenceScreen] Map ready');
          setIsMapReady(true);
        }}
        onRegionChangeComplete={setCurrentRegion}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        loadingEnabled={Platform.OS === 'ios'}
        loadingIndicatorColor="#8B5CF6"
      >
        {/* 渲染圍欄 */}
        {isMapReady && geofences.map(geofence => (
          <React.Fragment key={geofence.id}>
            {/* 圍欄圓圈 */}
            <Circle
              center={{
                latitude: geofence.latitude,
                longitude: geofence.longitude,
              }}
              radius={geofence.radius}
              fillColor={`${getGeofenceColor(geofence.name)}33`}
              strokeColor={getGeofenceColor(geofence.name)}
              strokeWidth={2}
            />
            {/* 圍欄標記 */}
            <Marker
              coordinate={{
                latitude: geofence.latitude,
                longitude: geofence.longitude,
              }}
              title={geofence.name}
              description={`安全區域 • 半徑 ${geofence.radius} 公尺`}
            >
              <View style={[styles.markerContainer, { backgroundColor: getGeofenceColor(geofence.name) }]}>
                <Text style={styles.markerIcon}>{geofence.icon}</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* 選中的自訂位置 */}
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title="新圍欄位置"
            description="點擊「新增」確認建立圍欄"
          >
            <View style={[styles.markerContainer, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.markerIcon}>📍</Text>
            </View>
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
          地理圍欄：<Text style={styles.patientName}>{patientName}</Text>
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* 浮動底部控制面板 */}
      <View style={styles.bottomPanel}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 已設定圍欄列表 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>已設定的安全區域</Text>
            {geofences.length === 0 ? (
              <Text style={styles.emptyText}>尚未設定任何安全區域</Text>
            ) : (
              geofences.map(geofence => (
                <View key={geofence.id} style={styles.geofenceItem}>
                  <View style={styles.geofenceInfo}>
                    <Text style={styles.geofenceName}>{geofence.icon} {geofence.name}</Text>
                    <Text style={styles.geofenceRadius}>半徑：{geofence.radius} 公尺</Text>
                  </View>
                  {geofence.id !== 'home' && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeGeofence(geofence.id)}
                    >
                      <Text style={styles.removeButtonText}>移除</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>

          {/* 智慧推薦 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>智慧推薦</Text>
            <Text style={styles.sectionSubtitle}>根據長者習慣，快速新增常用地點</Text>
            <View style={styles.recommendationGrid}>
              {SMART_RECOMMENDATIONS.map((recommendation, index) => {
                const isAlreadyAdded = geofences.some(g => g.name === recommendation.name);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.recommendationButton,
                      { backgroundColor: `${recommendation.color}20` },
                      isAlreadyAdded && styles.recommendationButtonDisabled
                    ]}
                    onPress={() => !isAlreadyAdded && addGeofence(recommendation)}
                    disabled={isAlreadyAdded}
                  >
                    <Text style={[
                      styles.recommendationText,
                      { color: recommendation.color },
                      isAlreadyAdded && styles.recommendationTextDisabled
                    ]}>
                      {isAlreadyAdded ? '✓' : '+'} {recommendation.icon} {recommendation.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 自訂新增 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>自訂新增</Text>
            <TouchableOpacity
              style={styles.customAddButton}
              onPress={() => {
                setIsAddingGeofence(true);
                Alert.alert(
                  '選擇位置',
                  '請在地圖上點選要設定圍欄的位置',
                  [
                    { text: '取消', onPress: () => setIsAddingGeofence(false) },
                    { text: '了解' }
                  ]
                );
              }}
            >
              <Text style={styles.customAddButtonText}>📍 點擊地圖選擇位置</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* 自訂圍欄模態框 */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>新增自訂圍欄</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>地點名稱：</Text>
              <TextInput
                style={styles.textInput}
                value={customAddress}
                onChangeText={setCustomAddress}
                placeholder="輸入地點名稱"
                placeholderTextColor="#999"
              />
            </View>

            {selectedLocation && (
              <View style={styles.coordinatesInfo}>
                <Text style={styles.coordinatesText}>
                  位置：{selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setSelectedLocation(null);
                  setCustomAddress('');
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={addCustomGeofence}
              >
                <Text style={styles.modalConfirmText}>新增</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    color: '#8B5CF6',
    fontWeight: 'bold',
  },
  placeholder: {
    width: 32,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: height * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  geofenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 8,
  },
  geofenceInfo: {
    flex: 1,
  },
  geofenceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  geofenceRadius: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  recommendationButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  recommendationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationTextDisabled: {
    color: '#9CA3AF',
  },
  customAddButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  customAddButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  markerIcon: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F9FAFB',
  },
  coordinatesInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalConfirmButton: {
    backgroundColor: '#8B5CF6',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

export default EnhancedGeofenceScreen;