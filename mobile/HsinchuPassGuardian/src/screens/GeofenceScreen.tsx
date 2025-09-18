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
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

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
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 高質感漸層標題欄 */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.headerOverlay} />
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <View style={styles.backButtonContainer}>
            <Text style={styles.backButton}>←</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <View style={styles.titleIconContainer}>
            <Text style={styles.titleIcon}>🛡️</Text>
          </View>
          <Text style={styles.headerTitle}>地理圍欄</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Map')} activeOpacity={0.8}>
          <View style={styles.mapButtonContainer}>
            <Text style={styles.mapButton}>🗺️</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {/* 內容區域帶微妙陰影 */}
      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}>
          {/* 功能說明卡片 */}
          <LinearGradient
            colors={['rgba(102, 126, 234, 0.08)', 'rgba(118, 75, 162, 0.05)']}
            style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Text style={styles.infoIcon}>💡</Text>
              </View>
              <Text style={styles.infoTitle}>地理圍欄功能</Text>
            </View>
            <Text style={styles.infoText}>
              設定安全區域，當患者離開指定範圍時，系統會立即發送警報通知{'\n'}
              確保長者安全，提供即時位置監控
            </Text>
          </LinearGradient>

          {geofences.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['rgba(102, 126, 234, 0.08)', 'rgba(118, 75, 162, 0.05)']}
                style={styles.emptyIconContainer}>
                <View style={styles.emptyIconInner}>
                  <Text style={styles.emptyIcon}>🎯</Text>
                </View>
              </LinearGradient>
              <Text style={styles.emptyTitle}>尚未設定圍欄</Text>
              <Text style={styles.emptyText}>請前往地圖設定安全區域{'\n'}保障長者活動安全</Text>
              <TouchableOpacity
                style={styles.addButtonWrapper}
                onPress={() => navigation.navigate('Map')}
                activeOpacity={0.9}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.addButton}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}>
                  <Text style={styles.addButtonText}>📍 前往地圖設定</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            geofences.map((fence, index) => (
              <View key={fence.id} style={[styles.geofenceCard, { zIndex: geofences.length - index }]}>
                <View style={styles.geofenceCardInner}>
                  <View style={styles.geofenceHeader}>
                    <View style={styles.geofenceInfo}>
                      <View style={styles.geofenceNameContainer}>
                        <View style={styles.geofenceIconContainer}>
                          <Text style={styles.geofenceCardIcon}>🛡️</Text>
                        </View>
                        <View>
                          <Text style={styles.geofenceName}>{fence.name}</Text>
                          <Text style={styles.geofenceSubInfo}>
                            半徑 {fence.radius} 公尺
                          </Text>
                        </View>
                      </View>
                      <View style={styles.statusContainer}>
                        <TouchableOpacity
                          style={[
                            styles.toggleButton,
                            fence.active && styles.toggleButtonActive
                          ]}
                          onPress={() => toggleGeofence(fence.id)}
                          activeOpacity={0.8}>
                          <Text style={[
                            styles.toggleText,
                            fence.active && styles.toggleTextActive
                          ]}>
                            {fence.active ? '✓ 啟用' : '◦ 停用'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <View style={styles.locationInfo}>
                    <View style={styles.coordContainer}>
                      <Text style={styles.coordLabel}>座標位置</Text>
                      <Text style={styles.coordText}>
                        📍 {fence.center_lat.toFixed(6)}, {fence.center_lng.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 25,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    position: 'relative',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  titleIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mapButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mapButton: {
    fontSize: 20,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#fafbfc',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 18,
    fontSize: 17,
    color: '#667eea',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  infoCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.15)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.2)',
  },
  infoIcon: {
    fontSize: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: 0.3,
  },
  infoText: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 35,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyIconInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.15)',
  },
  emptyIcon: {
    fontSize: 55,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 17,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 30,
  },
  addButtonWrapper: {
    borderRadius: 18,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  addButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  geofenceCard: {
    marginBottom: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  geofenceCardInner: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.08)',
    backgroundColor: '#FFFFFF',
  },
  geofenceHeader: {
    marginBottom: 18,
  },
  geofenceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  geofenceNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  geofenceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.2)',
  },
  geofenceCardIcon: {
    fontSize: 24,
  },
  geofenceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  geofenceSubInfo: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusContainer: {
    marginLeft: 15,
  },
  toggleButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.3,
  },
  toggleTextActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  locationInfo: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(102, 126, 234, 0.08)',
    paddingTop: 18,
  },
  coordContainer: {
    backgroundColor: 'rgba(102, 126, 234, 0.03)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  coordLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  coordText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

export default GeofenceScreen;