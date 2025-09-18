import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { State } from 'react-native-ble-plx';
import BLEService from '../services/BLEService';

interface BeaconItem {
  id: string;
  name: string;
  rssi: number;
  distance: number;
  timestamp: number;
}

const BeaconScanScreen = ({ navigation }: any) => {
  const [beacons, setBeacons] = useState<BeaconItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [bleState, setBleState] = useState<State>(State.Unknown);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeBLE();

    return () => {
      BLEService.stopScan();
    };
  }, []);

  const initializeBLE = async () => {
    const initialized = await BLEService.initialize();

    if (!initialized) {
      Alert.alert(
        '藍牙未開啟',
        '請開啟藍牙以掃描守護裝置',
        [{ text: '確定' }]
      );
    }

    // Monitor BLE state changes
    BLEService.onStateChange((state) => {
      setBleState(state);
      if (state === State.PoweredOn && isScanning) {
        startScan();
      }
    });

    const currentState = await BLEService.getState();
    setBleState(currentState);
  };

  const startScan = async () => {
    if (bleState !== State.PoweredOn) {
      Alert.alert('提示', '請先開啟藍牙');
      return;
    }

    setIsScanning(true);
    setBeacons([]); // Clear previous results

    await BLEService.startScan(
      (device) => {
        setBeacons((prev) => {
          const existing = prev.findIndex((b) => b.id === device.id);
          if (existing >= 0) {
            // Update existing beacon
            const updated = [...prev];
            updated[existing] = device;
            return updated.sort((a, b) => b.rssi - a.rssi); // Sort by signal strength
          } else {
            // Add new beacon
            return [...prev, device].sort((a, b) => b.rssi - a.rssi);
          }
        });
      },
      30000 // Scan for 30 seconds
    );

    // Auto stop after 30 seconds
    setTimeout(() => {
      stopScan();
    }, 30000);
  };

  const stopScan = () => {
    BLEService.stopScan();
    setIsScanning(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (isScanning) {
      stopScan();
    }
    startScan();
  };

  const connectToBeacon = async (beacon: BeaconItem) => {
    Alert.alert(
      '連接信標',
      `要連接到 ${beacon.name} 嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '連接',
          onPress: async () => {
            const device = await BLEService.connectToDevice(beacon.id);
            if (device) {
              Alert.alert('成功', `已連接到 ${beacon.name}`);
            } else {
              Alert.alert('失敗', '無法連接到該裝置');
            }
          },
        },
      ]
    );
  };

  const getSignalStrengthIcon = (rssi: number) => {
    if (rssi >= -50) return '📶'; // Excellent
    if (rssi >= -60) return '📶'; // Good
    if (rssi >= -70) return '📶'; // Fair
    return '📶'; // Poor
  };

  const getDistanceColor = (distance: number) => {
    if (distance <= 1) return '#4CAF50'; // Green - Very close
    if (distance <= 5) return '#FFC107'; // Yellow - Near
    if (distance <= 10) return '#FF9800'; // Orange - Medium
    return '#F44336'; // Red - Far
  };

  const renderBeaconItem = ({ item }: { item: BeaconItem }) => {
    const timeSinceDetection = Math.floor((Date.now() - item.timestamp) / 1000);

    return (
      <TouchableOpacity
        style={styles.beaconItem}
        onPress={() => connectToBeacon(item)}>
        <View style={styles.beaconHeader}>
          <Text style={styles.beaconName}>{item.name}</Text>
          <Text style={styles.signalIcon}>{getSignalStrengthIcon(item.rssi)}</Text>
        </View>

        <View style={styles.beaconDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>訊號強度:</Text>
            <Text style={styles.detailValue}>{item.rssi} dBm</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>距離:</Text>
            <Text
              style={[
                styles.detailValue,
                { color: getDistanceColor(item.distance) },
              ]}>
              ~{item.distance.toFixed(1)} 公尺
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>最後偵測:</Text>
            <Text style={styles.detailValue}>{timeSinceDetection}秒前</Text>
          </View>
        </View>

        <View style={styles.beaconIdContainer}>
          <Text style={styles.beaconId}>ID: {item.id}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getBleStateText = () => {
    switch (bleState) {
      case State.PoweredOn:
        return '藍牙已開啟';
      case State.PoweredOff:
        return '藍牙已關閉';
      case State.Unauthorized:
        return '未授權使用藍牙';
      case State.Unsupported:
        return '裝置不支援藍牙';
      default:
        return '檢查藍牙狀態中...';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>信標掃描</Text>
        <Text style={styles.bleStatus}>{getBleStateText()}</Text>
      </View>

      <View style={styles.controls}>
        {!isScanning ? (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={startScan}
            disabled={bleState !== State.PoweredOn}>
            <Text style={styles.scanButtonText}>開始掃描</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.scanButton, styles.stopButton]}
            onPress={stopScan}>
            <ActivityIndicator color="#FFF" style={{ marginRight: 10 }} />
            <Text style={styles.scanButtonText}>停止掃描</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            發現的裝置 ({beacons.length})
          </Text>
          {isScanning && (
            <ActivityIndicator size="small" color="#4A90E2" />
          )}
        </View>

        <FlatList
          data={beacons}
          keyExtractor={(item) => item.id}
          renderItem={renderBeaconItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {isScanning
                  ? '掃描中...'
                  : '尚未發現任何信標裝置'}
              </Text>
              <Text style={styles.emptySubtext}>
                {!isScanning && '點擊「開始掃描」尋找附近的守護裝置'}
              </Text>
            </View>
          }
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 提示：請確保守護裝置已開啟且在附近
        </Text>
      </View>
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
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  bleStatus: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 5,
    opacity: 0.9,
  },
  controls: {
    padding: 20,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  beaconItem: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  beaconHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  beaconName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  signalIcon: {
    fontSize: 20,
  },
  beaconDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  beaconIdContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 10,
  },
  beaconId: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    padding: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default BeaconScanScreen;