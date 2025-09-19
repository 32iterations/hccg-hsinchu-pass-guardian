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
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import ApiService from '../services/api';
import BLEService from '../services/BLEService';

const { width } = Dimensions.get('window');

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
        try {
          await ApiService.updateFCMToken(fcmToken);
        } catch (tokenError) {
          console.warn('Failed to update FCM token:', tokenError);
          // Continue without failing - this is not critical
        }

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
      // Continue without Firebase notifications - app should still work
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

  const handleEmergencyCall = async () => {
    Alert.alert(
      '緊急求救',
      '確定要發送緊急求救訊號嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await ApiService.sendEmergencyAlert();
              if (result.success) {
                Alert.alert('成功', '緊急求救訊號已發送！');
              } else {
                Alert.alert('錯誤', '發送失敗，請重試');
              }
            } catch (error) {
              Alert.alert('錯誤', '發送緊急求救失敗');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareLocation = async () => {
    setIsLoading(true);
    try {
      const result = await ApiService.shareCurrentLocation();
      if (result.success) {
        Alert.alert('成功', '位置已分享給所有聯絡人');
      } else {
        Alert.alert('錯誤', '分享位置失敗');
      }
    } catch (error) {
      Alert.alert('錯誤', '分享位置失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactFamily = async () => {
    try {
      const result = await ApiService.getEmergencyContacts();
      if (result?.success && result?.contacts?.length > 0) {
        const contactOptions = (result.contacts || []).map((contact: any, index: number) => ({
          text: `${contact.name} (${contact.phone})`,
          onPress: () => {
            Alert.alert(
              '聯絡確認',
              `確定要撥打給 ${contact.name}？`,
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '撥打',
                  onPress: () => {
                    // 使用 Linking 來撥打電話
                    const phoneUrl = `tel:${contact.phone}`;
                    require('react-native').Linking.openURL(phoneUrl).catch(() => {
                      Alert.alert('錯誤', '無法撥打電話');
                    });
                  },
                },
              ]
            );
          },
        }));

        Alert.alert(
          '選擇聯絡人',
          '請選擇要聯絡的家屬：',
          [
            ...contactOptions,
            { text: '取消', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('提示', '尚未設定緊急聯絡人');
      }
    } catch (error) {
      Alert.alert('錯誤', '獲取聯絡人失敗');
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
      gradient: ['#667eea', '#764ba2'],
    },
    {
      id: 'map',
      title: '即時定位',
      icon: '🗺️',
      description: '查看患者位置與軌跡',
      screen: 'Map',
      gradient: ['#667eea', '#764ba2'],
    },
    {
      id: 'patients',
      title: '患者管理',
      icon: '👥',
      description: '管理守護對象資料',
      screen: 'Patients',
      gradient: ['#667eea', '#764ba2'],
    },
    {
      id: 'alerts',
      title: '警報記錄',
      icon: '🚨',
      description: '查看歷史警報訊息',
      screen: 'Alerts',
      gradient: ['#667eea', '#764ba2'],
    },
    {
      id: 'geofence',
      title: '地理圍欄',
      icon: '🎯',
      description: '設定安全區域',
      screen: 'Geofence',
      gradient: ['#667eea', '#764ba2'],
    },
    {
      id: 'settings',
      title: '系統設定',
      icon: '⚙️',
      description: '個人資料與偏好設定',
      screen: 'Settings',
      gradient: ['#667eea', '#764ba2'],
    },
  ];

  // Filter menu items based on user role
  const filteredMenuItems = userRole === 'volunteer'
    ? menuItems.filter(item => !['patients', 'geofence'].includes(item.id))
    : menuItems;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* Modern Gradient Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>

        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>您好，{userName} 👋</Text>
            <Text style={styles.role}>
              {userRole === 'family' ? '👨‍👩‍👧‍👦 家屬' : '🤝 志工'}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}>
              <View style={styles.glassButton}>
                <Text style={styles.notificationIcon}>🔔</Text>
                {notificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {notificationCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.logoutGradient}>
                <Text style={styles.logoutText}>登出</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modern Status Cards */}
        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>📶</Text>
            <View>
              <Text style={styles.statusLabel}>藍牙狀態</Text>
              <Text style={styles.statusValue}>
                {bleStatus === 'PoweredOn' ? '✅ 已開啟' : '❌ 未開啟'}
              </Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>🌐</Text>
            <View>
              <Text style={styles.statusLabel}>連線狀態</Text>
              <Text style={styles.statusValue}>✅ 正常</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Modern Menu Grid with Glass Cards */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>

        <View style={styles.menuGrid}>
          {filteredMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItemWrapper}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.9}>
              <LinearGradient
                colors={item.gradient}
                style={styles.menuItem}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}>
                <View style={styles.menuContent}>
                  <View style={styles.menuIconContainer}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Modern Stats Dashboard */}
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
          style={styles.statsContainer}>
          <Text style={styles.statsTitle}>📊 今日統計</Text>
          <View style={styles.statsGrid}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.statItem}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>守護對象</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.statItem}>
              <Text style={styles.statValue}>15</Text>
              <Text style={styles.statLabel}>位置更新</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>警報事件</Text>
            </LinearGradient>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.quickActionsTitle}>⚡ 快速操作</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleEmergencyCall}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.quickActionGradient}>
                <Text style={styles.quickActionIcon}>🆘</Text>
                <Text style={styles.quickActionText}>緊急求救</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleShareLocation}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.quickActionGradient}>
                <Text style={styles.quickActionIcon}>📍</Text>
                <Text style={styles.quickActionText}>分享位置</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleContactFamily}
              activeOpacity={0.8}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.quickActionGradient}>
                <Text style={styles.quickActionIcon}>📞</Text>
                <Text style={styles.quickActionText}>聯絡家屬</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>處理中...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    position: 'relative',
  },
  glassButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  notificationIcon: {
    fontSize: 22,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4757',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notificationBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  logoutGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoutText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    gap: 15,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 10,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
  },
  menuItemWrapper: {
    width: (width - 45) / 2,
    height: 160,
  },
  menuItem: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  menuContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconContainer: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  menuIcon: {
    fontSize: 32,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  statsContainer: {
    margin: 15,
    borderRadius: 25,
    padding: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  quickActions: {
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 15,
  },
  quickActionButton: {
    marginRight: 10,
  },
  quickActionGradient: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 100,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
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
  loadingCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
});

export default MainScreen;