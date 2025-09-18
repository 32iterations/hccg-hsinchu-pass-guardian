import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

const SettingsScreen = ({ navigation }: any) => {
  const [userData, setUserData] = useState<any>({});
  const [notifications, setNotifications] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [autoSOS, setAutoSOS] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  useEffect(() => {
    loadUserData();
    loadSettings();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const parsed = JSON.parse(data);
        setUserData(parsed);
        setEditedData(parsed);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('appSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setNotifications(parsed.notifications ?? true);
        setLocationTracking(parsed.locationTracking ?? true);
        setAutoSOS(parsed.autoSOS ?? false);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const settings = {
        notifications,
        locationTracking,
        autoSOS,
      };
      await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
      Alert.alert('成功', '設定已儲存');
    } catch (error) {
      Alert.alert('錯誤', '儲存設定失敗');
    }
  };

  const saveProfile = async () => {
    try {
      const result = await ApiService.updateProfile(editedData.name, editedData.phone);
      if (result.success) {
        setUserData(editedData);
        await AsyncStorage.setItem('userData', JSON.stringify(editedData));
        setIsEditing(false);
        Alert.alert('成功', '個人資料已更新');
      }
    } catch (error) {
      Alert.alert('錯誤', '更新失敗');
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
            await AsyncStorage.clear();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

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
            <Text style={styles.titleIcon}>⚙️</Text>
          </View>
          <Text style={styles.headerTitle}>系統設定</Text>
        </View>
        <View style={{ width: 50 }} />
      </LinearGradient>

      {/* 內容區域帶微妙陰影 */}
      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>個人資料</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Text style={styles.editButton}>{isEditing ? '取消' : '編輯'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <Text style={styles.label}>姓名</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editedData.name || ''}
                  onChangeText={(text) => setEditedData({...editedData, name: text})}
                />
              ) : (
                <Text style={styles.value}>{userData.name || '未設定'}</Text>
              )}
            </View>

            <View style={styles.profileRow}>
              <Text style={styles.label}>電子郵件</Text>
              <Text style={styles.value}>{userData.email || '未設定'}</Text>
            </View>

            <View style={styles.profileRow}>
              <Text style={styles.label}>電話</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editedData.phone || ''}
                  onChangeText={(text) => setEditedData({...editedData, phone: text})}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.value}>{userData.phone || '未設定'}</Text>
              )}
            </View>

            <View style={styles.profileRow}>
              <Text style={styles.label}>角色</Text>
              <Text style={styles.value}>
                {userData.role === 'elder' ? '長者' : userData.role === 'family' ? '家屬' : '志工'}
              </Text>
            </View>

            {isEditing && (
              <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                <Text style={styles.saveButtonText}>儲存變更</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知設定</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>推播通知</Text>
                <Text style={styles.settingDesc}>接收警報與提醒通知</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={(value) => {
                  setNotifications(value);
                  saveSettings();
                }}
                trackColor={{ false: '#CBD5E0', true: '#667eea' }}
                thumbColor={notifications ? '#667eea' : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>位置追蹤</Text>
                <Text style={styles.settingDesc}>背景定位與軌跡記錄</Text>
              </View>
              <Switch
                value={locationTracking}
                onValueChange={(value) => {
                  setLocationTracking(value);
                  saveSettings();
                }}
                trackColor={{ false: '#CBD5E0', true: '#667eea' }}
                thumbColor={locationTracking ? '#667eea' : '#F3F4F6'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>自動求救</Text>
                <Text style={styles.settingDesc}>跌倒偵測自動發送SOS</Text>
              </View>
              <Switch
                value={autoSOS}
                onValueChange={(value) => {
                  setAutoSOS(value);
                  saveSettings();
                }}
                trackColor={{ false: '#CBD5E0', true: '#667eea' }}
                thumbColor={autoSOS ? '#667eea' : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        {/* Other Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>
          <TouchableOpacity style={styles.optionButton}>
            <Text style={styles.optionText}>關於我們</Text>
            <Text style={styles.optionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton}>
            <Text style={styles.optionText}>隱私權政策</Text>
            <Text style={styles.optionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton}>
            <Text style={styles.optionText}>使用條款</Text>
            <Text style={styles.optionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton}>
            <Text style={styles.optionText}>版本資訊 v1.2.0</Text>
            <Text style={styles.optionArrow}>→</Text>
          </TouchableOpacity>
        </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>登出</Text>
          </TouchableOpacity>
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
    paddingTop: 20,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  editButton: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  input: {
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 150,
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
  },
  optionArrow: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;