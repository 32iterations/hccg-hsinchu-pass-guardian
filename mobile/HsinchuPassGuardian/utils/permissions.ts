import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

export const checkLocationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: '位置權限請求',
          message: '應用程式需要存取您的位置來提供定位服務',
          buttonNeutral: '稍後詢問',
          buttonNegative: '拒絕',
          buttonPositive: '允許',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      if (result === RESULTS.DENIED) {
        const requestResult = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        return requestResult === RESULTS.GRANTED;
      }
      return result === RESULTS.GRANTED;
    }
  } catch (err) {
    console.error('Permission check error:', err);
    return false;
  }
};

export const checkBluetoothPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const bluetoothScan = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: '藍牙掃描權限',
            message: '應用程式需要藍牙掃描權限來尋找附近的信標裝置',
            buttonNeutral: '稍後詢問',
            buttonNegative: '拒絕',
            buttonPositive: '允許',
          }
        );

        const bluetoothConnect = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: '藍牙連接權限',
            message: '應用程式需要藍牙連接權限來與信標裝置通訊',
            buttonNeutral: '稍後詢問',
            buttonNegative: '拒絕',
            buttonPositive: '允許',
          }
        );

        return bluetoothScan === PermissionsAndroid.RESULTS.GRANTED &&
               bluetoothConnect === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const locationGranted = await checkLocationPermission();
        return locationGranted;
      }
    } else {
      const result = await check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
      if (result === RESULTS.DENIED) {
        const requestResult = await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
        return requestResult === RESULTS.GRANTED;
      }
      return result === RESULTS.GRANTED;
    }
  } catch (err) {
    console.error('Bluetooth permission check error:', err);
    return false;
  }
};

export const checkNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: '通知權限',
          message: '應用程式需要發送通知來提醒您重要事件',
          buttonNeutral: '稍後詢問',
          buttonNegative: '拒絕',
          buttonPositive: '允許',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (err) {
    console.error('Notification permission check error:', err);
    return false;
  }
};

export const showPermissionAlert = (
  permissionType: string,
  onRetry?: () => void
) => {
  Alert.alert(
    `需要${permissionType}權限`,
    `請在設定中開啟${permissionType}權限以使用此功能`,
    [
      {
        text: '取消',
        style: 'cancel',
      },
      {
        text: '前往設定',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            openSettings().catch(() => {
              console.error('Cannot open settings');
            });
          }
        },
      },
      ...(onRetry ? [{
        text: '重試',
        onPress: onRetry,
      }] : []),
    ]
  );
};

export const checkAllPermissions = async (): Promise<{
  location: boolean;
  bluetooth: boolean;
  notification: boolean;
}> => {
  const [location, bluetooth, notification] = await Promise.all([
    checkLocationPermission(),
    checkBluetoothPermission(),
    checkNotificationPermission(),
  ]);

  return {
    location,
    bluetooth,
    notification,
  };
};