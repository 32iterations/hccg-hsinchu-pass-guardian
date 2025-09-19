import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadGeofences();
  }, []);

  const loadGeofences = async () => {
    try {
      setIsLoading(true);
      const result = await ApiService.getGeofences();
      if (result.success && result.geofences) {
        setGeofences(result.geofences);
      } else {
        setGeofences([]);
      }
    } catch (error) {
      console.error('Failed to load geofences:', error);
      setGeofences([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadGeofences();
  };

  const toggleGeofence = async (id: string, currentStatus: boolean) => {
    try {
      // Update local state immediately for better UX
      setGeofences(prevGeofences =>
        prevGeofences.map(g =>
          g.id === id ? { ...g, active: !currentStatus } : g
        )
      );

      // Here you would call API to update status
      // await ApiService.updateGeofenceStatus(id, !currentStatus);
    } catch (error) {
      console.error('Failed to toggle geofence:', error);
      // Revert on error
      setGeofences(prevGeofences =>
        prevGeofences.map(g =>
          g.id === id ? { ...g, active: currentStatus } : g
        )
      );
      Alert.alert('錯誤', '無法更新地理圍欄狀態');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>地理圍欄</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Map')}
            style={styles.mapButton}>
            <Text style={styles.mapButtonText}>🗺️</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
          />
        }>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoTitle}>地理圍欄功能</Text>
          </View>
          <Text style={styles.infoText}>
            設定安全區域，當患者離開指定範圍時，系統會立即發送警報通知
          </Text>
        </View>

        {geofences.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>尚未設定圍欄</Text>
            <Text style={styles.emptyText}>
              請前往地圖設定安全區域{'\n'}保障長者活動安全
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('Map')}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.addButtonGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <Text style={styles.addButtonText}>📍 前往地圖設定</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          geofences.map((fence) => (
            <View key={fence.id} style={styles.geofenceCard}>
              <View style={styles.geofenceHeader}>
                <View style={styles.geofenceInfo}>
                  <Text style={styles.geofenceIcon}>🛡️</Text>
                  <View style={styles.geofenceDetails}>
                    <Text style={styles.geofenceName}>{fence.name}</Text>
                    <Text style={styles.geofenceSubInfo}>
                      半徑: {fence.radius} 公尺
                    </Text>
                  </View>
                </View>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>
                    {fence.active ? '啟用' : '停用'}
                  </Text>
                  <Switch
                    value={fence.active}
                    onValueChange={() => toggleGeofence(fence.id, fence.active)}
                    trackColor={{ false: '#ccc', true: '#667eea' }}
                    thumbColor={fence.active ? '#764ba2' : '#f4f3f4'}
                  />
                </View>
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.coordLabel}>座標位置</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapButtonText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoCard: {
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.15)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  geofenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  geofenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  geofenceIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  geofenceDetails: {
    flex: 1,
  },
  geofenceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  geofenceSubInfo: {
    fontSize: 13,
    color: '#6b7280',
  },
  switchContainer: {
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  locationInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 5,
  },
  coordText: {
    fontSize: 13,
    color: '#4b5563',
  },
});

export default GeofenceScreen;