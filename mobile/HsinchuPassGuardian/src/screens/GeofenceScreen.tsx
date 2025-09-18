import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import ApiService from '../services/api';

interface Geofence {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius: number;
  active: boolean;
  patient_id: string;
}

const GeofenceScreen = ({ navigation }: any) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    radius: '100',
  });

  useEffect(() => {
    loadGeofences();
  }, []);

  const loadGeofences = async () => {
    try {
      setIsLoading(true);
      // For now, load geofences for patient "1"
      const result = await ApiService.getGeofences('1');
      if (result.success && result.geofences) {
        setGeofences(result.geofences);
      }
    } catch (error) {
      console.error('Failed to load geofences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGeofence = (id: string) => {
    setGeofences(geofences.map(g =>
      g.id === id ? { ...g, active: !g.active } : g
    ));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>地理圍欄</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Map')}>
          <Text style={styles.mapButton}>🗺️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>地理圍欄功能</Text>
          <Text style={styles.infoText}>
            設定安全區域，當患者離開指定範圍時，系統會立即發送警報通知
          </Text>
        </View>

        {geofences.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>尚未設定地理圍欄</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('Map')}>
              <Text style={styles.addButtonText}>前往地圖設定</Text>
            </TouchableOpacity>
          </View>
        ) : (
          geofences.map(fence => (
            <View key={fence.id} style={styles.geofenceCard}>
              <View style={styles.geofenceHeader}>
                <View>
                  <Text style={styles.geofenceName}>{fence.name}</Text>
                  <Text style={styles.geofenceInfo}>
                    半徑: {fence.radius} 公尺
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    fence.active && styles.toggleButtonActive
                  ]}
                  onPress={() => toggleGeofence(fence.id)}>
                  <Text style={styles.toggleText}>
                    {fence.active ? '啟用' : '停用'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.coordText}>
                  📍 {fence.center_lat.toFixed(6)}, {fence.center_lng.toFixed(6)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingTop: 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  backButton: {
    fontSize: 24,
    color: '#FFF',
  },
  mapButton: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#3B82F6',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  geofenceCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  geofenceInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  toggleButtonActive: {
    backgroundColor: '#10B981',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  locationInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  coordText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default GeofenceScreen;