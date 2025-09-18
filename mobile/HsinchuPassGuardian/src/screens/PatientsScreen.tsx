import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import ApiService from '../services/api';

interface Patient {
  id: string;
  name: string;
  age: number;
  address: string;
  emergency_contact: string;
  beacon_id?: string;
  status: 'safe' | 'warning' | 'danger';
}

const PatientsScreen = ({ navigation }: any) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    address: '',
    emergency_contact: '',
    beacon_id: '',
  });

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setIsLoading(true);
      const result = await ApiService.getPatients();
      if (result.success && result.patients) {
        setPatients(result.patients);
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
      Alert.alert('錯誤', '無法載入患者資料');
    } finally {
      setIsLoading(false);
    }
  };

  const addPatient = async () => {
    if (!newPatient.name || !newPatient.age || !newPatient.emergency_contact) {
      Alert.alert('錯誤', '請填寫必要欄位');
      return;
    }

    try {
      const result = await ApiService.addPatient({
        ...newPatient,
        age: parseInt(newPatient.age),
      });

      if (result.success) {
        Alert.alert('成功', '患者資料已新增');
        setIsModalVisible(false);
        setNewPatient({
          name: '',
          age: '',
          address: '',
          emergency_contact: '',
          beacon_id: '',
        });
        loadPatients();
      }
    } catch (error) {
      Alert.alert('錯誤', '新增患者失敗');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return '#4CAF50';
      case 'warning': return '#FFC107';
      case 'danger': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'safe': return '安全';
      case 'warning': return '注意';
      case 'danger': return '危險';
      default: return '未知';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>患者管理</Text>
        <TouchableOpacity onPress={() => setIsModalVisible(true)}>
          <Text style={styles.addButton}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>尚無患者資料</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setIsModalVisible(true)}>
              <Text style={styles.emptyButtonText}>新增患者</Text>
            </TouchableOpacity>
          </View>
        ) : (
          patients.map(patient => (
            <TouchableOpacity
              key={patient.id}
              style={styles.patientCard}
              onPress={() => navigation.navigate('Map', { patientId: patient.id })}>
              <View style={styles.patientHeader}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(patient.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(patient.status)}</Text>
                </View>
              </View>
              <Text style={styles.patientInfo}>年齡: {patient.age} 歲</Text>
              <Text style={styles.patientInfo}>地址: {patient.address}</Text>
              <Text style={styles.patientInfo}>緊急聯絡: {patient.emergency_contact}</Text>
              {patient.beacon_id && (
                <Text style={styles.patientInfo}>信標: {patient.beacon_id}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>新增患者</Text>

            <TextInput
              style={styles.input}
              placeholder="姓名 *"
              value={newPatient.name}
              onChangeText={(text) => setNewPatient({...newPatient, name: text})}
            />

            <TextInput
              style={styles.input}
              placeholder="年齡 *"
              value={newPatient.age}
              onChangeText={(text) => setNewPatient({...newPatient, age: text})}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="地址"
              value={newPatient.address}
              onChangeText={(text) => setNewPatient({...newPatient, address: text})}
            />

            <TextInput
              style={styles.input}
              placeholder="緊急聯絡電話 *"
              value={newPatient.emergency_contact}
              onChangeText={(text) => setNewPatient({...newPatient, emergency_contact: text})}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="信標ID (選填)"
              value={newPatient.beacon_id}
              onChangeText={(text) => setNewPatient({...newPatient, beacon_id: text})}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsModalVisible(false)}>
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={addPatient}>
                <Text style={styles.buttonText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingTop: 40,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  backButton: {
    fontSize: 24,
    color: '#FFF',
  },
  addButton: {
    fontSize: 28,
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  patientCard: {
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
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  patientInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 20,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 5,
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  confirmButton: {
    backgroundColor: '#4A90E2',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PatientsScreen;