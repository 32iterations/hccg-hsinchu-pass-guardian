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
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

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

        // Skip Firebase auth for now - backend auth is sufficient
        console.log('Backend auth succeeded, proceeding to main screen');

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
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Glass Morphism Card */}
        <View style={styles.glassCard}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.logoBackground}>
              <Text style={styles.logoEmoji}>🛡️</Text>
            </LinearGradient>
            <Text style={styles.title}>新竹安心守護</Text>
            <Text style={styles.subtitle}>守護失智長者的智慧助手</Text>
          </View>

          {/* Role Selector with Modern Design */}
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                userRole === 'family' && styles.roleButtonActive,
              ]}
              onPress={() => setUserRole('family')}>
              <LinearGradient
                colors={userRole === 'family' ? ['#667eea', '#764ba2'] : ['#f3f4f6', '#f3f4f6']}
                style={styles.roleButtonGradient}>
                <Text
                  style={[
                    styles.roleButtonText,
                    userRole === 'family' && styles.roleButtonTextActive,
                  ]}>
                  👨‍👩‍👧‍👦 家屬
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                userRole === 'volunteer' && styles.roleButtonActive,
              ]}
              onPress={() => setUserRole('volunteer')}>
              <LinearGradient
                colors={userRole === 'volunteer' ? ['#667eea', '#764ba2'] : ['#f3f4f6', '#f3f4f6']}
                style={styles.roleButtonGradient}>
                <Text
                  style={[
                    styles.roleButtonText,
                    userRole === 'volunteer' && styles.roleButtonTextActive,
                  ]}>
                  🤝 志工
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Modern Input Fields */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={styles.input}
                placeholder="電子郵件"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="rgba(0,0,0,0.4)"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="密碼"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="rgba(0,0,0,0.4)"
              />
            </View>
          </View>

          {/* Gradient Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.loginButton}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>登入</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotButton}
            onPress={handleForgotPassword}>
            <Text style={styles.forgotButtonText}>忘記密碼？</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Button with Outline */}
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}>
            <Text style={styles.registerButtonText}>註冊新帳號</Text>
          </TouchableOpacity>

          {/* Test Login Button - 測試登入 */}
          <TouchableOpacity
            style={[styles.registerButton, {backgroundColor: '#28a745', marginTop: 10}]}
            onPress={() => {
              // 直接跳過驗證，進入主畫面
              AsyncStorage.setItem('token', 'test-token-123');
              AsyncStorage.setItem('isLoggedIn', 'true');
              AsyncStorage.setItem('userEmail', 'test@example.com');
              navigation.navigate('Main');
            }}>
            <Text style={[styles.registerButtonText, {color: '#fff'}]}>🚀 快速測試登入</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Wave Decoration */}
        <View style={styles.bottomDecoration}>
          <Text style={styles.versionText}>v1.0.8 · 2025</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  glassCard: {
    width: width - 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.6)',
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  roleButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  roleButtonActive: {
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  roleButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  inputIcon: {
    fontSize: 22,
    marginRight: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 16,
    color: '#1a1a2e',
  },
  loginButton: {
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotButtonText: {
    color: '#667eea',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dividerText: {
    marginHorizontal: 15,
    color: 'rgba(0,0,0,0.4)',
    fontSize: 14,
    fontWeight: '500',
  },
  registerButton: {
    borderWidth: 2,
    borderColor: '#667eea',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
  },
  registerButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default LoginScreen;