import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import ApiService from '../services/api';

const RegisterScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<'family' | 'volunteer'>('family');

  const handleRegister = async () => {
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('錯誤', '請填寫所有必填欄位');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('錯誤', '密碼不一致');
      return;
    }

    if (password.length < 6) {
      Alert.alert('錯誤', '密碼至少需要6個字元');
      return;
    }

    setIsLoading(true);
    try {
      // Register with backend API
      const apiResponse = await ApiService.register(email, password, name, userRole, phone);

      if (apiResponse.success) {
        // Store user data
        await AsyncStorage.setItem('userToken', apiResponse.token!);
        await AsyncStorage.setItem('userRole', userRole);
        await AsyncStorage.setItem('userData', JSON.stringify(apiResponse.user));

        // Also create Firebase user for push notifications
        try {
          await auth().createUserWithEmailAndPassword(email, password);
          await auth().currentUser?.updateProfile({
            displayName: name,
          });
        } catch (firebaseError) {
          console.log('Firebase auth creation failed, but backend registration succeeded');
        }

        Alert.alert(
          '註冊成功',
          '您的帳號已建立完成',
          [{ text: '確定', onPress: () => navigation.replace('Main') }]
        );
      } else {
        // If backend fails, try Firebase auth as fallback
        try {
          const userCredential = await auth().createUserWithEmailAndPassword(email, password);
          await userCredential.user.updateProfile({
            displayName: name,
          });
          await AsyncStorage.setItem('userToken', userCredential.user.uid);
          await AsyncStorage.setItem('userRole', userRole);

          Alert.alert(
            '註冊成功',
            '您的帳號已建立完成',
            [{ text: '確定', onPress: () => navigation.replace('Main') }]
          );
        } catch (firebaseError: any) {
          let message = apiResponse.error || '註冊失敗，請稍後再試';
          if (firebaseError.code === 'auth/email-already-in-use') {
            message = '此電子郵件已被使用';
          } else if (firebaseError.code === 'auth/invalid-email') {
            message = '電子郵件格式錯誤';
          } else if (firebaseError.code === 'auth/weak-password') {
            message = '密碼強度不足';
          }
          Alert.alert('註冊失敗', message);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('註冊失敗', '網路連線錯誤，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>建立新帳號</Text>
          <Text style={styles.subtitle}>加入新竹安心守護</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                userRole === 'family' && styles.roleButtonActive,
              ]}
              onPress={() => setUserRole('family')}>
              <Text
                style={[
                  styles.roleButtonText,
                  userRole === 'family' && styles.roleButtonTextActive,
                ]}>
                家屬
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                userRole === 'volunteer' && styles.roleButtonActive,
              ]}
              onPress={() => setUserRole('volunteer')}>
              <Text
                style={[
                  styles.roleButtonText,
                  userRole === 'volunteer' && styles.roleButtonTextActive,
                ]}>
                志工
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="姓名 *"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#999"
          />

          <TextInput
            style={styles.input}
            placeholder="電子郵件 *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />

          <TextInput
            style={styles.input}
            placeholder="聯絡電話"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />

          <TextInput
            style={styles.input}
            placeholder="密碼 (至少6個字元) *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#999"
          />

          <TextInput
            style={styles.input}
            placeholder="確認密碼 *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor="#999"
          />

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.registerButtonText}>註冊</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>已有帳號？</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>立即登入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 30,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    padding: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 22,
  },
  roleButtonActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  roleButtonText: {
    fontSize: 16,
    color: '#666',
  },
  roleButtonTextActive: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  registerButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  registerButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
});

export default RegisterScreen;