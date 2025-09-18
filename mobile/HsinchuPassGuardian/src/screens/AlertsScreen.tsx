import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
  patient_id?: string;
}

const AlertsScreen = ({ navigation }: any) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const result = await ApiService.getAlerts();
      if (result.success && result.alerts) {
        setAlerts(result.alerts);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      await ApiService.markAlertRead(alertId);
      setAlerts(alerts.map(a =>
        a.id === alertId ? { ...a, is_read: true } : a
      ));
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'geofence_exit': return '📍';
      case 'low_battery': return '🔋';
      case 'sos': return '🆘';
      case 'daily_checkin': return '✅';
      default: return '⚠️';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'sos': return '#EF4444';
      case 'geofence_exit': return '#F59E0B';
      case 'low_battery': return '#3B82F6';
      default: return '#6B7280';
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
            <Text style={styles.titleIcon}>🚨</Text>
          </View>
          <Text style={styles.headerTitle}>警報記錄</Text>
        </View>
        <View style={{ width: 50 }} />
      </LinearGradient>

      {/* 內容區域帶微妙陰影 */}
      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadAlerts();
              }}
              tintColor="#667eea"
              colors={['#667eea']}
            />
          }>
          {alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['rgba(102, 126, 234, 0.08)', 'rgba(118, 75, 162, 0.05)']}
                style={styles.emptyIconContainer}>
                <View style={styles.emptyIconInner}>
                  <Text style={styles.emptyIcon}>🔔</Text>
                </View>
              </LinearGradient>
              <Text style={styles.emptyTitle}>暫無警報</Text>
              <Text style={styles.emptyText}>目前沒有任何警報記錄{'\n'}系統將在有新警報時通知您</Text>
            </View>
          ) : (
            alerts.map((alert, index) => (
              <View key={alert.id} style={[styles.alertCard, { zIndex: alerts.length - index }]}>
                <TouchableOpacity
                  style={[
                    styles.alertCardInner,
                    !alert.is_read && styles.unreadCard
                  ]}
                  onPress={() => markAsRead(alert.id)}
                  activeOpacity={0.9}>
                  {/* 高質感圖示背景 */}
                  <LinearGradient
                    colors={[
                      getAlertColor(alert.type) + '15',
                      getAlertColor(alert.type) + '08'
                    ]}
                    style={styles.alertIcon}>
                    <View style={styles.iconInnerShadow}>
                      <Text style={styles.iconText}>{getAlertIcon(alert.type)}</Text>
                    </View>
                  </LinearGradient>

                  <View style={styles.alertContent}>
                    <View style={styles.alertHeader}>
                      <Text style={[styles.alertTitle, !alert.is_read && styles.unreadText]}>
                        {alert.title}
                      </Text>
                      {!alert.is_read && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                    <View style={styles.alertTimeContainer}>
                      <Text style={styles.alertTime}>
                        {new Date(alert.timestamp).toLocaleString('zh-TW')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
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
  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
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
  },
  alertCard: {
    marginBottom: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  alertCardInner: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.08)',
    backgroundColor: '#FFFFFF',
  },
  unreadCard: {
    backgroundColor: 'rgba(102, 126, 234, 0.03)',
    borderColor: 'rgba(102, 126, 234, 0.15)',
    borderWidth: 2,
    shadowColor: '#667eea',
    shadowOpacity: 0.12,
  },
  alertIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  iconInnerShadow: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  iconText: {
    fontSize: 28,
  },
  alertContent: {
    flex: 1,
    paddingTop: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    lineHeight: 24,
    flex: 1,
    letterSpacing: 0.3,
  },
  unreadText: {
    fontWeight: '800',
    color: '#667eea',
  },
  unreadBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: '500',
  },
  alertTimeContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(102, 126, 234, 0.08)',
    paddingTop: 12,
  },
  alertTime: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default AlertsScreen;