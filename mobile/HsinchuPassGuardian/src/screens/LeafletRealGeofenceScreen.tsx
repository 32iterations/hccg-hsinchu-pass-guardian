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
  Modal,
  TextInput,
  ScrollView,
  Switch,
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

interface Geofence {
  id: number;
  name: string;
  patient_id: number;
  center_latitude: number;
  center_longitude: number;
  radius: number;
  alert_on_exit: boolean;
  alert_on_enter: boolean;
  description?: string;
  created_at: string;
}

interface Location {
  latitude: number;
  longitude: number;
}

// 新竹市推薦地點
const HSINCHU_RECOMMENDATIONS = [
  { name: '新竹火車站', latitude: 24.8016, longitude: 120.9714, radius: 200 },
  { name: '新竹市政府', latitude: 24.8038, longitude: 120.9713, radius: 150 },
  { name: '東門城', latitude: 24.8016, longitude: 120.9672, radius: 100 },
  { name: '新竹公園', latitude: 24.8031, longitude: 120.9781, radius: 300 },
  { name: '巨城購物中心', latitude: 24.8093, longitude: 120.9754, radius: 250 },
  { name: '新竹醫院', latitude: 24.8146, longitude: 120.9685, radius: 200 },
  { name: '清華大學', latitude: 24.7958, longitude: 120.9918, radius: 500 },
  { name: '交通大學', latitude: 24.7871, longitude: 120.9976, radius: 500 },
];

const LeafletRealGeofenceScreen = ({ navigation, route }: any) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // 圍欄創建相關狀態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    radius: 100,
    description: '',
    alert_on_exit: true,
    alert_on_enter: false,
  });

  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeScreen();
    setupNetworkListener();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (selectedPatient && isMapReady) {
      loadGeofences();
      startAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [selectedPatient, isMapReady]);

  const initializeScreen = async () => {
    try {
      console.log('[LeafletRealGeofenceScreen] Initializing screen...');
      await loadPatients();
      setIsLoading(false);
    } catch (error) {
      console.error('[LeafletRealGeofenceScreen] Initialization error:', error);
      setIsLoading(false);
      Alert.alert('錯誤', '初始化失敗，請檢查網路連線');
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (state.isConnected && selectedPatient) {
        loadGeofences();
      }
    });

    return unsubscribe;
  };

  const loadPatients = async () => {
    try {
      console.log('[LeafletRealGeofenceScreen] Loading patients...');
      const response = await apiService.getPatients();

      if (response.success && response.patients) {
        setPatients(response.patients);

        if (response.patients.length > 0) {
          const firstPatient = response.patients[0];
          setSelectedPatient(firstPatient);
          console.log('[LeafletRealGeofenceScreen] Auto-selected first patient:', firstPatient.name);
        }
      } else {
        console.error('[LeafletRealGeofenceScreen] Failed to load patients:', response);
      }
    } catch (error) {
      console.error('[LeafletRealGeofenceScreen] Error loading patients:', error);
      throw error;
    }
  };

  const loadGeofences = async () => {
    if (!selectedPatient) return;

    try {
      console.log('[LeafletRealGeofenceScreen] Loading geofences for patient:', selectedPatient.id);
      const response = await apiService.getGeofences(selectedPatient.id);

      if (response.success && response.geofences) {
        setGeofences(response.geofences);
        console.log('[LeafletRealGeofenceScreen] Loaded geofences:', response.geofences.length);
      } else {
        console.error('[LeafletRealGeofenceScreen] Failed to load geofences:', response);
      }
    } catch (error) {
      console.error('[LeafletRealGeofenceScreen] Error loading geofences:', error);
    }
  };

  const startAutoRefresh = () => {
    console.log('[LeafletRealGeofenceScreen] Starting auto-refresh...');

    refreshInterval.current = setInterval(() => {
      if (isConnected && selectedPatient) {
        loadGeofences();
      }
    }, 30000); // 每30秒刷新一次
  };

  const stopAutoRefresh = () => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
  };

  const cleanup = () => {
    stopAutoRefresh();
  };

  const handleMapReady = () => {
    console.log('[LeafletRealGeofenceScreen] Map is ready');
    setIsMapReady(true);
  };

  const handleMapClick = (location: Location) => {
    console.log('[LeafletRealGeofenceScreen] Map clicked:', location);
    setSelectedLocation(location);
    setShowCreateModal(true);
  };

  const handleRecommendationSelect = (recommendation: any) => {
    setSelectedLocation({
      latitude: recommendation.latitude,
      longitude: recommendation.longitude,
    });
    setNewGeofence({
      ...newGeofence,
      name: recommendation.name,
      radius: recommendation.radius,
    });
    setShowRecommendations(false);
    setShowCreateModal(true);
  };

  const createCustomGeofence = async () => {
    if (!selectedPatient || !selectedLocation) {
      Alert.alert('錯誤', '請選擇患者和位置');
      return;
    }

    if (!newGeofence.name.trim()) {
      Alert.alert('錯誤', '請輸入圍欄名稱');
      return;
    }

    try {
      console.log('[LeafletRealGeofenceScreen] Creating geofence:', newGeofence);

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
        resetNewGeofence();
        loadGeofences(); // 重新載入圍欄列表
      } else {
        Alert.alert('錯誤', response.error || '創建圍欄失敗');
      }
    } catch (error) {
      console.error('[LeafletRealGeofenceScreen] Error creating custom geofence:', error);
      Alert.alert('錯誤', '創建圍欄時發生錯誤');
    }
  };

  const deleteGeofence = async (geofence: Geofence) => {
    Alert.alert(
      '確認刪除',
      `確定要刪除圍欄「${geofence.name}」嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteGeofence(geofence.id);
              if (response.success) {
                Alert.alert('成功', '圍欄已刪除');
                loadGeofences();
              } else {
                Alert.alert('錯誤', response.error || '刪除失敗');
              }
            } catch (error) {
              console.error('[LeafletRealGeofenceScreen] Error deleting geofence:', error);
              Alert.alert('錯誤', '刪除圍欄時發生錯誤');
            }
          },
        },
      ]
    );
  };

  const resetNewGeofence = () => {
    setNewGeofence({
      name: '',
      radius: 100,
      description: '',
      alert_on_exit: true,
      alert_on_enter: false,
    });
    setSelectedLocation(null);
  };

  const switchPatient = () => {
    if (patients.length <= 1) return;

    const currentIndex = patients.findIndex(p => p.id === selectedPatient?.id);
    const nextIndex = (currentIndex + 1) % patients.length;
    const nextPatient = patients[nextIndex];

    setSelectedPatient(nextPatient);
    setGeofences([]);
    console.log('[LeafletRealGeofenceScreen] Switched to patient:', nextPatient.name);
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
          <Text style={styles.headerTitle}>地理圍欄管理</Text>
          <Text style={styles.headerSubtitle}>
            {selectedPatient ? selectedPatient.name : '無患者'} ({geofences.length} 個圍欄)
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
          locations={[]}
          geofences={geofences}
          mode="geofence"
          onMapReady={handleMapReady}
          onGeofenceCreate={handleMapClick}
        />
      </View>

      {/* 底部控制面板 */}
      <View style={styles.bottomPanel}>
        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowRecommendations(true)}
            disabled={!selectedPatient}
          >
            <Text style={styles.addButtonText}>+ 推薦地點</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadGeofences}
            disabled={!isConnected || !selectedPatient}
          >
            <Text style={styles.refreshButtonText}>🔄 刷新</Text>
          </TouchableOpacity>
        </View>

        {/* 圍欄列表 */}
        <ScrollView style={styles.geofenceList} showsVerticalScrollIndicator={false}>
          {geofences.map((geofence) => (
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
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 推薦地點Modal */}
      <Modal
        visible={showRecommendations}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRecommendations(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>選擇新竹推薦地點</Text>
            <ScrollView style={styles.recommendationList}>
              {HSINCHU_RECOMMENDATIONS.map((rec, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recommendationItem}
                  onPress={() => handleRecommendationSelect(rec)}
                >
                  <Text style={styles.recommendationName}>{rec.name}</Text>
                  <Text style={styles.recommendationDetails}>
                    建議半徑: {rec.radius}m
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowRecommendations(false)}
            >
              <Text style={styles.modalCloseButtonText}>關閉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 創建圍欄Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>新增地理圍欄</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>圍欄名稱 *</Text>
              <TextInput
                style={styles.textInput}
                value={newGeofence.name}
                onChangeText={(text) => setNewGeofence({...newGeofence, name: text})}
                placeholder="請輸入圍欄名稱"
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>半徑 (公尺)</Text>
              <TextInput
                style={styles.textInput}
                value={newGeofence.radius.toString()}
                onChangeText={(text) => {
                  const radius = parseInt(text) || 100;
                  setNewGeofence({...newGeofence, radius: Math.max(50, Math.min(1000, radius))});
                }}
                placeholder="100"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>描述</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newGeofence.description}
                onChangeText={(text) => setNewGeofence({...newGeofence, description: text})}
                placeholder="可選擇性描述這個圍欄的用途"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>離開時警報</Text>
                <Switch
                  value={newGeofence.alert_on_exit}
                  onValueChange={(value) => setNewGeofence({...newGeofence, alert_on_exit: value})}
                  trackColor={{ false: '#767577', true: '#4A90E2' }}
                  thumbColor={newGeofence.alert_on_exit ? '#FFF' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>進入時警報</Text>
                <Switch
                  value={newGeofence.alert_on_enter}
                  onValueChange={(value) => setNewGeofence({...newGeofence, alert_on_enter: value})}
                  trackColor={{ false: '#767577', true: '#4A90E2' }}
                  thumbColor={newGeofence.alert_on_enter ? '#FFF' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  resetNewGeofence();
                }}
              >
                <Text style={styles.modalCancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCreateButton}
                onPress={createCustomGeofence}
              >
                <Text style={styles.modalCreateButtonText}>創建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 離線提示 */}
      {!isConnected && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineText}>⚠️ 網路連線中斷</Text>
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
    maxHeight: 250,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  controlButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#6B7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  geofenceList: {
    maxHeight: 150,
    paddingHorizontal: 16,
  },
  geofenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  geofenceInfo: {
    flex: 1,
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  geofenceDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    minWidth: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  recommendationList: {
    maxHeight: 300,
  },
  recommendationItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  recommendationDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchGroup: {
    marginBottom: 20,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#374151',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#6B7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCreateButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCreateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: '#6B7280',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineNotice: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FEF3C7',
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

export default LeafletRealGeofenceScreen;