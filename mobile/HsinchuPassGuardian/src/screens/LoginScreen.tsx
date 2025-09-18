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
  Image,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import ApiService from '../services/api';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<'family' | 'volunteer'>('family');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('錯誤', '請輸入電子郵件和密碼');
      return;
    }

    setIsLoading(true);
    try {
      // Try backend API first
      const apiResponse = await ApiService.login(email, password, userRole);

      if (apiResponse.success) {
        // Store user data
        await AsyncStorage.setItem('userToken', apiResponse.token!);
        await AsyncStorage.setItem('userRole', userRole);
        await AsyncStorage.setItem('userData', JSON.stringify(apiResponse.user));

        // Also try Firebase auth for push notifications
        try {
          await auth().signInWithEmailAndPassword(email, password);
        } catch (firebaseError) {
          console.log('Firebase auth failed, but backend auth succeeded');
        }

        navigation.replace('Main');
      } else {
        // If backend fails, try Firebase auth as fallback
        try {
          const userCredential = await auth().signInWithEmailAndPassword(email, password);
          await AsyncStorage.setItem('userToken', userCredential.user.uid);
          await AsyncStorage.setItem('userRole', userRole);
          navigation.replace('Main');
        } catch (firebaseError: any) {
          let message = apiResponse.error || '登入失敗，請稍後再試';
          if (firebaseError.code === 'auth/user-not-found') {
            message = '找不到此使用者';
          } else if (firebaseError.code === 'auth/wrong-password') {
            message = '密碼錯誤';
          } else if (firebaseError.code === 'auth/invalid-email') {
            message = '電子郵件格式錯誤';
          }
          Alert.alert('登入失敗', message);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('登入失敗', '網路連線錯誤，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('提示', '請先輸入您的電子郵件');
      return;
    }

    try {
      await auth().sendPasswordResetEmail(email);
      Alert.alert('成功', '密碼重設連結已發送到您的信箱');
    } catch (error) {
      Alert.alert('錯誤', '無法發送密碼重設郵件');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>新竹安心守護</Text>
        <Text style={styles.subtitle}>守護失智長者的智慧助手</Text>
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
          placeholder="電子郵件"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#999"
        />

        <TextInput
          style={styles.input}
          placeholder="密碼"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.loginButtonText}>登入</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleForgotPassword}>
          <Text style={styles.forgotButtonText}>忘記密碼？</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>或</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}>
          <Text style={styles.registerButtonText}>註冊新帳號</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
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
  loginButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotButtonText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
  },
  registerButton: {
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;