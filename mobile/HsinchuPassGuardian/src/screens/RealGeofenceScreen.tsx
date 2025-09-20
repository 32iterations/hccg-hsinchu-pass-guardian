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
  Dimensions,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
  Region,
  MapPressEvent,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import apiService, { Patient, Geofence } from '../services/api';
import { GEOFENCE_CONFIG } from '../../config';

const { width, height } = Dimensions.get('window');

interface SmartRecommendation {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  category: string;
  icon: string;
  color: string;
  description: string;
}

// 新竹地區預設座標
const DEFAULT_REGION: Region = {
  latitude: 24.8113,
  longitude: 120.9715,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

// 新竹重要地點智慧推薦
const SMART_RECOMMENDATIONS: SmartRecommendation[] = [
  {
    name: '新竹公園',
    latitude: 24.8049,
    longitude: 120.9719,
    radius: 300,
    category: 'park',
    icon: '🌳',
    color: '#10B981',
    description: '適合散步的安全區域',
  },
  {
    name: '新竹馬偕紀念醫院',
    latitude: 24.8072,
    longitude: 120.9724,
    radius: 200,
    category: 'hospital',
    icon: '🏥',
    color: '#EF4444',
    description: '醫療機構周邊',
  },
  {
    name: '巨城購物中心',
    latitude: 24.8089,
    longitude: 120.9735,
    radius: 250,
    category: 'shopping',
    icon: '🛒',
    color: '#F59E0B',
    description: '購物休閒區域',
  },
  {
    name: '新竹火車站',
    latitude: 24.8019,
    longitude: 120.9718,
    radius: 300,
    category: 'transport',
    icon: '🚂',
    color: '#3B82F6',
    description: '交通樞紐區域',
  },
  {
    name: '新竹都城隍廟',
    latitude: 24.8061,
    longitude: 120.9658,
    radius: 150,
    category: 'cultural',
    icon: '🏛️',
    color: '#8B5CF6',
    description: '文化古蹟區域',
  },
  {
    name: '東門市場',
    latitude: 24.8033,
    longitude: 120.9666,
    radius: 200,
    category: 'market',
    icon: '🏪',
    color: '#06B6D4',
    description: '傳統市場區域',
  },
];

const RealGeofenceScreen = ({ navigation, route }: any) => {
  const mapRef = useRef<MapView>(null);

  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [recommendations] = useState<SmartRecommendation[]>(SMART_RECOMMENDATIONS);

  // UI states
  const [currentRegion, setCurrentRegion] = useState<Region>(DEFAULT_REGION);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Form states
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    description: '',
    radius: GEOFENCE_CONFIG.DEFAULT_RADIUS,
    alert_on_exit: true,
    alert_on_enter: false,
  });

  useEffect(() => {
    initializeScreen();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientGeofences(selectedPatient.id);
    }
  }, [selectedPatient]);

  const initializeScreen = async () => {
    console.log('[RealGeofenceScreen] Initializing screen...');

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
      console.error('[RealGeofenceScreen] Initialization error:', error);
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

      // Load all geofences
      const geofencesResponse = await apiService.getGeofences();
      if (geofencesResponse.success) {
        setGeofences(geofencesResponse.geofences);
      }

    } catch (error) {
      console.error('[RealGeofenceScreen] Error loading initial data:', error);
    }
  };

  const loadPatientGeofences = async (patientId: number) => {
    try {
      const geofencesResponse = await apiService.getGeofences();
      if (geofencesResponse.success) {
        const patientGeofences = geofencesResponse.geofences.filter(
          g => g.patient_id === patientId
        );
        setGeofences(patientGeofences);
      }
    } catch (error) {
      console.error('[RealGeofenceScreen] Error loading patient geofences:', error);
    }
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: '位置權限',
            message: '需要您的位置權限來設置地理圍欄',
            buttonNeutral: '稍後詢問',
            buttonNegative: '取消',
            buttonPositive: '確定',
          }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const onMapPress = (event: MapPressEvent) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    setShowCreateModal(true);
  };

  const addRecommendedGeofence = async (recommendation: SmartRecommendation) => {
    if (!selectedPatient) {
      Alert.alert('錯誤', '請先選擇患者');
      return;
    }

    try {
      const response = await apiService.createGeofence({
        name: recommendation.name,
        patient_id: selectedPatient.id,
        center_latitude: recommendation.latitude,
        center_longitude: recommendation.longitude,
        radius: recommendation.radius,
        description: recommendation.description,
        alert_on_exit: true,
        alert_on_enter: false,
      });

      if (response.success) {
        Alert.alert('成功', `已新增地理圍欄: ${recommendation.name}`);
        await loadPatientGeofences(selectedPatient.id);
      }
    } catch (error) {
      console.error('[RealGeofenceScreen] Error creating recommended geofence:', error);
      Alert.alert('錯誤', '新增地理圍欄失敗');
    }
  };

  const createCustomGeofence = async () => {
    if (!selectedPatient || !selectedLocation) {
      Alert.alert('錯誤', '請先選擇患者和位置');
      return;
    }

    if (!newGeofence.name.trim()) {
      Alert.alert('錯誤', '請輸入圍欄名稱');
      return;
    }

    try {
      const response = await apiService.createGeofence({
        name: newGeofence.name.trim(),
        patient_id: selectedPatient.id,
        center_latitude: selectedLocation.latitude,
        center_longitude: selectedLocation.longitude,
        radius: newGeofence.radius,
        description: newGeofence.description,
        alert_on_exit: newGeofence.alert_on_exit,
        alert_on_enter: newGeofence.alert_on_enter,
      });

      if (response.success) {
        Alert.alert('成功', `已新增地理圍欄: ${newGeofence.name}`);
        setShowCreateModal(false);
        setSelectedLocation(null);
        setNewGeofence({
          name: '',
          description: '',
          radius: GEOFENCE_CONFIG.DEFAULT_RADIUS,
          alert_on_exit: true,
          alert_on_enter: false,
        });
        await loadPatientGeofences(selectedPatient.id);
      }
    } catch (error) {
      console.error('[RealGeofenceScreen] Error creating custom geofence:', error);
      Alert.alert('錯誤', '新增地理圍欄失敗');
    }
  };

  const deleteGeofence = async (geofence: Geofence) => {
    Alert.alert(
      '確認刪除',
      `確定要刪除地理圍欄「${geofence.name}」嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (geofence.id) {
                await apiService.deleteGeofence(geofence.id);
                Alert.alert('成功', '地理圍欄已刪除');
                if (selectedPatient) {
                  await loadPatientGeofences(selectedPatient.id);
                }
              }
            } catch (error) {
              console.error('[RealGeofenceScreen] Error deleting geofence:', error);
              Alert.alert('錯誤', '刪除地理圍欄失敗');
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInitialData();
      if (selectedPatient) {
        await loadPatientGeofences(selectedPatient.id);
      }
    } catch (error) {
      console.error('[RealGeofenceScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [selectedPatient]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>載入地理圍欄資料...</Text>
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
        onMapReady={() => setIsMapReady(true)}
        onPress={onMapPress}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Existing Geofences */}
        {geofences.map(geofence => (
          <React.Fragment key={geofence.id}>
            <Circle
              center={{
                latitude: geofence.center_latitude,
                longitude: geofence.center_longitude,
              }}
              radius={geofence.radius}
              strokeColor="#4A90E2"
              strokeWidth={2}
              fillColor="rgba(74, 144, 226, 0.2)"
            />
            <Marker
              coordinate={{
                latitude: geofence.center_latitude,
                longitude: geofence.center_longitude,
              }}
              title={geofence.name}
              description={geofence.description || `半徑: ${geofence.radius}公尺`}
              onCalloutPress={() => deleteGeofence(geofence)}
            >
              <View style={styles.geofenceMarker}>
                <Text style={styles.markerText}>📍</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Recommended Locations */}
        {recommendations.map((rec, index) => (
          <Marker
            key={`rec-${index}`}
            coordinate={{ latitude: rec.latitude, longitude: rec.longitude }}
            title={rec.name}
            description={rec.description}
            onCalloutPress={() => addRecommendedGeofence(rec)}
          >
            <View style={[styles.recommendedMarker, { backgroundColor: rec.color }]}>
              <Text style={styles.markerIcon}>{rec.icon}</Text>
            </View>
          </Marker>
        ))}

        {/* Selected Location for New Geofence */}
        {selectedLocation && (
          <Circle
            center={selectedLocation}
            radius={newGeofence.radius}
            strokeColor="#10B981"
            strokeWidth={2}
            fillColor="rgba(16, 185, 129, 0.2)"
          />
        )}
      </MapView>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <Text style={styles.panelTitle}>地理圍欄管理</Text>

        {/* Patient Selector */}
        <View style={styles.patientSelector}>
          <Text style={styles.selectorLabel}>選擇患者:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
          </ScrollView>
        </View>

        {/* Geofence List */}
        <View style={styles.geofenceList}>
          <Text style={styles.sectionTitle}>
            現有圍欄 ({geofences.length})
          </Text>
          <ScrollView style={styles.geofenceScroll}>
            {geofences.map(geofence => (
              <View key={geofence.id} style={styles.geofenceItem}>
                <View style={styles.geofenceInfo}>
                  <Text style={styles.geofenceName}>{geofence.name}</Text>
                  <Text style={styles.geofenceDetails}>
                    半徑: {geofence.radius}m |
                    {geofence.alert_on_exit ? ' 離開警報' : ''}
                    {geofence.alert_on_enter ? ' 進入警報' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteGeofence(geofence)}
                >
                  <Text style={styles.deleteButtonText}>刪除</Text>
                </TouchableOpacity>
              </View>
            ))}
            {geofences.length === 0 && (
              <Text style={styles.emptyText}>尚未設置地理圍欄</Text>
            )}
          </ScrollView>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            💡 點擊地圖設置自訂圍欄，或點擊推薦地點快速新增
          </Text>
        </View>
      </View>

      {/* Create Geofence Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>新增地理圍欄</Text>

            <TextInput
              style={styles.input}
              placeholder="圍欄名稱 *"
              value={newGeofence.name}
              onChangeText={(text) => setNewGeofence(prev => ({ ...prev, name: text }))}
            />

            <TextInput
              style={styles.input}
              placeholder="描述 (選填)"
              value={newGeofence.description}
              onChangeText={(text) => setNewGeofence(prev => ({ ...prev, description: text }))}
              multiline
            />

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                半徑: {newGeofence.radius} 公尺
              </Text>
              <View style={styles.radiusButtons}>
                {[50, 100, 200, 500].map(radius => (
                  <TouchableOpacity
                    key={radius}
                    style={[
                      styles.radiusButton,
                      newGeofence.radius === radius && styles.selectedRadiusButton
                    ]}
                    onPress={() => setNewGeofence(prev => ({ ...prev, radius }))}
                  >
                    <Text style={[
                      styles.radiusButtonText,
                      newGeofence.radius === radius && styles.selectedRadiusButtonText
                    ]}>
                      {radius}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.switchContainer}>
              <TouchableOpacity
                style={[
                  styles.switchButton,
                  newGeofence.alert_on_exit && styles.switchButtonActive
                ]}
                onPress={() => setNewGeofence(prev => ({
                  ...prev,
                  alert_on_exit: !prev.alert_on_exit
                }))}
              >
                <Text style={[
                  styles.switchButtonText,
                  newGeofence.alert_on_exit && styles.switchButtonTextActive
                ]}>
                  離開時警報
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.switchButton,
                  newGeofence.alert_on_enter && styles.switchButtonActive
                ]}
                onPress={() => setNewGeofence(prev => ({
                  ...prev,
                  alert_on_enter: !prev.alert_on_enter
                }))}
              >
                <Text style={[
                  styles.switchButtonText,
                  newGeofence.alert_on_enter && styles.switchButtonTextActive
                ]}>
                  進入時警報
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={createCustomGeofence}
              >
                <Text style={styles.createButtonText}>新增</Text>
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
  geofenceMarker: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendedMarker: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    fontSize: 20,
  },
  markerIcon: {
    fontSize: 16,
  },
  controlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.5,
    paddingTop: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  patientSelector: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  patientButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedPatientButton: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  patientButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedPatientButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  geofenceList: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  geofenceScroll: {
    maxHeight: 120,
  },
  geofenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  geofenceInfo: {
    flex: 1,
  },
  geofenceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  geofenceDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  instructions: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  radiusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  radiusButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedRadiusButton: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  radiusButtonText: {
    fontSize: 12,
    color: '#666',
  },
  selectedRadiusButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  switchButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  switchButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  switchButtonText: {
    fontSize: 14,
    color: '#666',
  },
  switchButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  createButton: {
    backgroundColor: '#4A90E2',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RealGeofenceScreen;