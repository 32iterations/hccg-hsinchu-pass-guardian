import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import {ActivityIndicator, View, StyleSheet} from 'react-native';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainScreen from './src/screens/MainScreen';
import BeaconScanScreen from './src/screens/BeaconScanScreen';
import MapScreen from './src/screens/MapScreen';
import SimulationScreen from './src/screens/SimulationScreen';
import PatientsScreen from './src/screens/PatientsScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import GeofenceScreen from './src/screens/GeofenceScreen';
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
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);

        // Save token for later use
        await AsyncStorage.setItem('fcmToken', token);
      }

      // Handle background messages
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('Background message:', remoteMessage);
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
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
          component={MapScreen}
          options={{ title: '即時定位' }}
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
          component={GeofenceScreen}
          options={{ title: '地理圍欄' }}
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