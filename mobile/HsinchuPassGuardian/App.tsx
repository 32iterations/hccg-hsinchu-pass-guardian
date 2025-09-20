import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessaging,
  requestPermission,
  getToken,
  setBackgroundMessageHandler,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import ErrorBoundary from './components/ErrorBoundary';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainScreen from './src/screens/MainScreen';
import BeaconScanScreen from './src/screens/BeaconScanScreen';
import MapScreen from './src/screens/MapScreen';
import EnhancedMapScreen from './src/screens/EnhancedMapScreen';
import RealTimeMapScreen from './src/screens/RealTimeMapScreen';
import LeafletRealTimeMapScreen from './src/screens/LeafletRealTimeMapScreen';
import SimulationScreen from './src/screens/SimulationScreen';
import PatientsScreen from './src/screens/PatientsScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import GeofenceScreen from './src/screens/GeofenceScreen';
import EnhancedGeofenceScreen from './src/screens/EnhancedGeofenceScreen';
import RealGeofenceScreen from './src/screens/RealGeofenceScreen';
import LeafletRealGeofenceScreen from './src/screens/LeafletRealGeofenceScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

function App(): React.JSX.Element {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    checkAuthStatus();
    // Initialize Firebase for push notifications
    initializeFirebase();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        setInitialRoute('Main');
      } else {
        setInitialRoute('Login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setInitialRoute('Login');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeFirebase = async () => {
    try {
      const messaging = getMessaging();

      // Request permission using modular API
      const authStatus = await requestPermission(messaging);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token using modular API
        const token = await getToken(messaging);
        console.log('FCM Token:', token);

        // Save token for later use
        await AsyncStorage.setItem('fcmToken', token);

        // Update FCM token to server with proper error handling
        updateFCMTokenToServer(token);
      }

      // Handle background messages using modular API
      setBackgroundMessageHandler(messaging, async remoteMessage => {
        console.log('Background message:', remoteMessage);
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  };

  const updateFCMTokenToServer = async (token: string) => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;

      const response = await fetch('http://147.251.115.54:3000/api/users/update-fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('FCM token updated successfully:', data);
      } else {
        console.warn('Server returned non-JSON response for FCM token update');
      }
    } catch (error) {
      console.error('Update FCM token error:', error);
    }
  };

  if (isLoading || !initialRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#4A90E2',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{
            title: '註冊',
            headerLeft: undefined,
          }}
        />
        <Stack.Screen
          name="Main"
          component={MainScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BeaconScan"
          component={BeaconScanScreen}
          options={{ title: '信標掃描' }}
        />
        <Stack.Screen
          name="Map"
          component={LeafletRealTimeMapScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OriginalMap"
          component={MapScreen}
          options={{ title: '原始地圖' }}
        />
        <Stack.Screen
          name="SimulationMap"
          component={EnhancedMapScreen}
          options={{ title: '模擬地圖' }}
        />
        <Stack.Screen
          name="GoogleRealTimeMap"
          component={RealTimeMapScreen}
          options={{ title: 'Google地圖版本' }}
        />
        <Stack.Screen
          name="Simulation"
          component={SimulationScreen}
          options={{ title: '位置模擬' }}
        />
        <Stack.Screen
          name="Patients"
          component={PatientsScreen}
          options={{ title: '患者管理' }}
        />
        <Stack.Screen
          name="Alerts"
          component={AlertsScreen}
          options={{ title: '警報記錄' }}
        />
        <Stack.Screen
          name="Geofence"
          component={LeafletRealGeofenceScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OriginalGeofence"
          component={GeofenceScreen}
          options={{ title: '原始圍欄' }}
        />
        <Stack.Screen
          name="SimulationGeofence"
          component={EnhancedGeofenceScreen}
          options={{ title: '模擬圍欄' }}
        />
        <Stack.Screen
          name="GoogleRealGeofence"
          component={RealGeofenceScreen}
          options={{ title: 'Google圍欄版本' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: '系統設定' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: '通知中心' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </ErrorBoundary>
  );
}

// Placeholder screens have been moved to separate files

const NotificationsScreen = () => {
  return (
    <View style={styles.placeholderContainer}>
      <ActivityIndicator size="large" color="#4A90E2" />
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});

export default App;