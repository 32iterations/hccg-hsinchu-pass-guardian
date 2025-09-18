import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

interface Geofence {
  id: number;
  name: string;
  patient_id: number;
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number;
  description: string;
  alert_on_exit: boolean;
  alert_on_enter: boolean;
  active: boolean;
}

interface GeofenceManagerProps {
  patientId: number;
  token: string;
}

const GeofenceManager: React.FC<GeofenceManagerProps> = ({ patientId, token }) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    radius: '100',
    description: '',
    useCurrentLocation: true,
    latitude: '',
    longitude: '',
  });
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => {
    loadGeofences();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setNewGeofence(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        }));
      },
      (error) => {
        console.error('Location error:', error);
        Alert.alert('錯誤', '無法取得目前位置');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const loadGeofences = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/geofences/patient/${patientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGeofences(data.geofences);
      }
    } catch (error) {
      console.error('Load geofences error:', error);
      Alert.alert('錯誤', '無法載入地理圍欄');
    } finally {
      setLoading(false);
    }
  };

  const createGeofence = async () => {
    if (!newGeofence.name || !newGeofence.radius) {
      Alert.alert('錯誤', '請填寫名稱和半徑');
      return;
    }

    const lat = newGeofence.useCurrentLocation
      ? currentLocation?.lat
      : parseFloat(newGeofence.latitude);
    const lng = newGeofence.useCurrentLocation
      ? currentLocation?.lng
      : parseFloat(newGeofence.longitude);

    if (!lat || !lng) {
      Alert.alert('錯誤', '請提供有效的位置');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/geofences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newGeofence.name,
          patient_id: patientId,
          center_latitude: lat,
          center_longitude: lng,
          radius: parseFloat(newGeofence.radius),
          description: newGeofence.description,
          alert_on_exit: true,
          alert_on_enter: true,
        }),
      });

      if (response.ok) {
        Alert.alert('成功', '地理圍欄已建立');
        setCreatingNew(false);
        setNewGeofence({
          name: '',
          radius: '100',
          description: '',
          useCurrentLocation: true,
          latitude: '',
          longitude: '',
        });
        loadGeofences();
      } else {
        const error = await response.json();
        Alert.alert('錯誤', error.error || '建立失敗');
      }
    } catch (error) {
      console.error('Create geofence error:', error);
      Alert.alert('錯誤', '建立地理圍欄失敗');
    }
  };

  const deleteGeofence = async (id: number) => {
    Alert.alert(
      '確認刪除',
      '確定要刪除這個地理圍欄嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/geofences/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                Alert.alert('成功', '地理圍欄已刪除');
                loadGeofences();
              }
            } catch (error) {
              console.error('Delete geofence error:', error);
              Alert.alert('錯誤', '刪除失敗');
            }
          },
        },
      ]
    );
  };

  const toggleGeofenceStatus = async (geofence: Geofence) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/geofences/${geofence.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert_on_exit: !geofence.alert_on_exit,
          alert_on_enter: !geofence.alert_on_enter,
        }),
      });

      if (response.ok) {
        loadGeofences();
      }
    } catch (error) {
      console.error('Toggle geofence error:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>載入中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>地理圍欄管理</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setCreatingNew(!creatingNew)}
        >
          <Text style={styles.addButtonText}>{creatingNew ? '取消' : '+ 新增'}</Text>
        </TouchableOpacity>
      </View>

      {creatingNew && (
        <View style={styles.newGeofenceForm}>
          <Text style={styles.formTitle}>建立新的安全區域</Text>

          <TextInput
            style={styles.input}
            placeholder="名稱（例：家）"
            value={newGeofence.name}
            onChangeText={(text) => setNewGeofence(prev => ({ ...prev, name: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder="半徑（公尺）"
            value={newGeofence.radius}
            keyboardType="numeric"
            onChangeText={(text) => setNewGeofence(prev => ({ ...prev, radius: text }))}
          />

          <TextInput
            style={styles.input}
            placeholder="描述（選填）"
            value={newGeofence.description}
            onChangeText={(text) => setNewGeofence(prev => ({ ...prev, description: text }))}
          />

          <View style={styles.locationToggle}>
            <Button
              title={newGeofence.useCurrentLocation ? '使用目前位置' : '手動輸入位置'}
              onPress={() => setNewGeofence(prev => ({
                ...prev,
                useCurrentLocation: !prev.useCurrentLocation,
              }))}
            />
          </View>

          {!newGeofence.useCurrentLocation && (
            <>
              <TextInput
                style={styles.input}
                placeholder="緯度"
                value={newGeofence.latitude}
                keyboardType="numeric"
                onChangeText={(text) => setNewGeofence(prev => ({ ...prev, latitude: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="經度"
                value={newGeofence.longitude}
                keyboardType="numeric"
                onChangeText={(text) => setNewGeofence(prev => ({ ...prev, longitude: text }))}
              />
            </>
          )}

          <TouchableOpacity style={styles.createButton} onPress={createGeofence}>
            <Text style={styles.createButtonText}>建立地理圍欄</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.geofenceList}>
        {geofences.length === 0 ? (
          <Text style={styles.emptyText}>尚未建立地理圍欄</Text>
        ) : (
          geofences.map((geofence) => (
            <View key={geofence.id} style={styles.geofenceCard}>
              <View style={styles.geofenceHeader}>
                <Text style={styles.geofenceName}>{geofence.name}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    {geofence.alert_on_exit ? '監控中' : '已停用'}
                  </Text>
                </View>
              </View>

              <Text style={styles.geofenceInfo}>
                📍 中心: {geofence.center.latitude.toFixed(6)}, {geofence.center.longitude.toFixed(6)}
              </Text>
              <Text style={styles.geofenceInfo}>
                📏 半徑: {geofence.radius} 公尺
              </Text>
              {geofence.description && (
                <Text style={styles.geofenceInfo}>📝 {geofence.description}</Text>
              )}

              <View style={styles.alertSettings}>
                <Text style={styles.alertLabel}>警報設定:</Text>
                <Text style={styles.alertInfo}>
                  {geofence.alert_on_exit && '✅ 離開時警報'}
                </Text>
                <Text style={styles.alertInfo}>
                  {geofence.alert_on_enter && '✅ 進入時警報'}
                </Text>
              </View>

              <View style={styles.geofenceActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => toggleGeofenceStatus(geofence)}
                >
                  <Text style={styles.actionButtonText}>
                    {geofence.alert_on_exit ? '停用' : '啟用'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteGeofence(geofence.id)}
                >
                  <Text style={styles.actionButtonText}>刪除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  newGeofenceForm: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  locationToggle: {
    marginVertical: 10,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  geofenceList: {
    padding: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
  },
  geofenceCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  geofenceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
  },
  geofenceInfo: {
    marginBottom: 5,
    color: '#666',
  },
  alertSettings: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  alertLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  alertInfo: {
    color: '#666',
    marginLeft: 10,
  },
  geofenceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default GeofenceManager;