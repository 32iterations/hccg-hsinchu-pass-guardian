import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import ApiService from '../services/api';
import BLEService from '../services/BLEService';

const MainScreen = ({ navigation }: any) => {
  const [userName, setUserName] = useState('使用者');
  const [userRole, setUserRole] = useState('family');
  const [notificationCount, setNotificationCount] = useState(0);
  const [bleStatus, setBleStatus] = useState('未知');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUserData();
    setupNotifications();
    initializeBLE();

    return () => {
      BLEService.destroy();
    };
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const role = await AsyncStorage.getItem('userRole');

      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.name || '使用者');
      }
      if (role) {
        setUserRole(role);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const setupNotifications = async () => {
    try {
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token
        const fcmToken = await messaging().getToken();
        console.log('FCM Token:', fcmToken);

        // Update token to backend
        await ApiService.updateFCMToken(fcmToken);

        // Listen to messages
        const unsubscribe = messaging().onMessage(async remoteMessage => {
          setNotificationCount(prev => prev + 1);

          if (Platform.OS === 'ios') {
            PushNotificationIOS.addNotificationRequest({
              id: String(Date.now()),
              title: remoteMessage.notification?.title || '新通知',
              body: remoteMessage.notification?.body || '',
              category: 'alert',
            });
          } else {
            Alert.alert(
              remoteMessage.notification?.title || '新通知',
              remoteMessage.notification?.body || ''
            );
          }
        });

        // Background message handler
        messaging().setBackgroundMessageHandler(async remoteMessage => {
          console.log('Background message:', remoteMessage);
        });

        return unsubscribe;
      }
    } catch (error) {
      console.error('Notification setup error:', error);
    }
  };

  const initializeBLE = async () => {
    const initialized = await BLEService.initialize();
    if (initialized) {
      const state = await BLEService.getState();
      setBleStatus(state);

      BLEService.onStateChange((newState) => {
        setBleStatus(newState);
      });
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      '登出確認',
      '確定要登出嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '登出',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await ApiService.logout();
              await AsyncStorage.clear();
              navigation.replace('Login');
            } catch (error) {
              Alert.alert('錯誤', '登出失敗');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      id: 'beacon',
      title: '信標掃描',
      icon: '📡',
      description: '掃描附近的守護裝置',
      screen: 'BeaconScan',
      color: '#4A90E2',
    },
    {
      id: 'map',
      title: '即時定位',
      icon: '🗺️',
      description: '查看患者位置與軌跡',
      screen: 'Map',
      color: '#4CAF50',
    },
    {
      id: 'patients',
      title: '患者管理',
      icon: '👥',
      description: '管理守護對象資料',
      screen: 'Patients',
      color: '#FF9800',
    },
    {
      id: 'alerts',
      title: '警報記錄',
      icon: '🚨',
      description: '查看歷史警報訊息',
      screen: 'Alerts',
      color: '#F44336',
    },
    {
      id: 'geofence',
      title: '地理圍欄',
      icon: '🎯',
      description: '設定安全區域',
      screen: 'Geofence',
      color: '#9C27B0',
    },
    {
      id: 'settings',
      title: '系統設定',
      icon: '⚙️',
      description: '個人資料與偏好設定',
      screen: 'Settings',
      color: '#607D8B',
    },
  ];

  // Filter menu items based on user role
  const filteredMenuItems = userRole === 'volunteer'
    ? menuItems.filter(item => !['patients', 'geofence'].includes(item.id))
    : menuItems;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>您好，{userName}</Text>
            <Text style={styles.role}>
              {userRole === 'family' ? '家屬' : '志工'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.notificationIcon}>🔔</Text>
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}>
              <Text style={styles.logoutText}>登出</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>藍牙狀態</Text>
            <Text style={styles.statusValue}>
              {bleStatus === 'PoweredOn' ? '已開啟' : '未開啟'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>連線狀態</Text>
            <Text style={styles.statusValue}>正常</Text>
          </View>
        </View>
      </View>

      {/* Menu Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menuGrid}>
          {filteredMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.8}>
              <View
                style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDescription}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>今日統計</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>守護對象</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>15</Text>
              <Text style={styles.statLabel}>位置更新</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>警報事件</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4A90E2" />
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
  header: {
    backgroundColor: '#4A90E2',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  role: {
    fontSize: 14,
    color: '#E3F2FD',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    marginRight: 15,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#E3F2FD',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuIcon: {
    fontSize: 30,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  menuDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: '#FFF',
    margin: 20,
    marginTop: 5,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MainScreen;