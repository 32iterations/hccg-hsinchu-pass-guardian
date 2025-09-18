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
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ApiService from '../services/api';

const { width } = Dimensions.get('window');

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
      case 'safe': return ['#10b981', '#34d399'];
      case 'warning': return ['#f59e0b', '#fbbf24'];
      case 'danger': return ['#ef4444', '#f87171'];
      default: return ['#6b7280', '#9ca3af'];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'safe': return '✅ 安全';
      case 'warning': return '⚠️ 注意';
      case 'danger': return '🚨 危險';
      default: return '❓ 未知';
    }
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#fa709a', '#fee140']} style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#fa709a" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#fa709a', '#fee140']}
        style={styles.header}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <View style={styles.backButtonContainer}>
            <Text style={styles.backButton}>←</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👥 患者管理</Text>
        <TouchableOpacity onPress={() => setIsModalVisible(true)}>
          <View style={styles.addButtonContainer}>
            <Text style={styles.addButton}>+</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['rgba(250, 112, 154, 0.1)', 'rgba(254, 225, 64, 0.1)']}
              style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>尚無患者資料</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(true)}>
                <LinearGradient
                  colors={['#fa709a', '#fee140']}
                  style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>新增患者</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          patients.map(patient => (
            <TouchableOpacity
              key={patient.id}
              onPress={() => navigation.navigate('Map', { patientId: patient.id })}
              activeOpacity={0.9}>
              <LinearGradient
                colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
                style={styles.patientCard}>
                <View style={styles.patientHeader}>
                  <View>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientAge}>🎂 {patient.age} 歲</Text>
                  </View>
                  <LinearGradient
                    colors={getStatusColor(patient.status)}
                    style={styles.statusBadge}>
                    <Text style={styles.statusText}>{getStatusText(patient.status)}</Text>
                  </LinearGradient>
                </View>

                <View style={styles.patientDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>🏠</Text>
                    <Text style={styles.detailText}>{patient.address || '未設定地址'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>📞</Text>
                    <Text style={styles.detailText}>{patient.emergency_contact}</Text>
                  </View>
                  {patient.beacon_id && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>📡</Text>
                      <Text style={styles.detailText}>信標: {patient.beacon_id}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButtonWrapper}>
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={styles.actionButton}>
                      <Text style={styles.actionButtonText}>📍 定位</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButtonWrapper}>
                    <LinearGradient
                      colors={['#f093fb', '#f5576c']}
                      style={styles.actionButton}>
                      <Text style={styles.actionButtonText}>📞 通話</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButtonWrapper}>
                    <LinearGradient
                      colors={['#30cfd0', '#330867']}
                      style={styles.actionButton}>
                      <Text style={styles.actionButtonText}>📝 編輯</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
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
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
            style={styles.modalContent}>
            <LinearGradient
              colors={['#fa709a', '#fee140']}
              style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✨ 新增患者</Text>
            </LinearGradient>

            <View style={styles.modalForm}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="姓名 *"
                  value={newPatient.name}
                  onChangeText={(text) => setNewPatient({...newPatient, name: text})}
                  placeholderTextColor="rgba(0,0,0,0.4)"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🎂</Text>
                <TextInput
                  style={styles.input}
                  placeholder="年齡 *"
                  value={newPatient.age}
                  onChangeText={(text) => setNewPatient({...newPatient, age: text})}
                  keyboardType="numeric"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🏠</Text>
                <TextInput
                  style={styles.input}
                  placeholder="地址"
                  value={newPatient.address}
                  onChangeText={(text) => setNewPatient({...newPatient, address: text})}
                  placeholderTextColor="rgba(0,0,0,0.4)"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📞</Text>
                <TextInput
                  style={styles.input}
                  placeholder="緊急聯絡電話 *"
                  value={newPatient.emergency_contact}
                  onChangeText={(text) => setNewPatient({...newPatient, emergency_contact: text})}
                  keyboardType="phone-pad"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📡</Text>
                <TextInput
                  style={styles.input}
                  placeholder="信標ID (選填)"
                  value={newPatient.beacon_id}
                  onChangeText={(text) => setNewPatient({...newPatient, beacon_id: text})}
                  placeholderTextColor="rgba(0,0,0,0.4)"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <LinearGradient
                  colors={['#6b7280', '#9ca3af']}
                  style={styles.button}>
                  <Text style={styles.buttonText}>取消</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={addPatient}>
                <LinearGradient
                  colors={['#fa709a', '#fee140']}
                  style={styles.button}>
                  <Text style={styles.buttonText}>確定</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  backButtonContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backButton: {
    fontSize: 24,
    color: '#FFF',
  },
  addButtonContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fa709a',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(250, 112, 154, 0.2)',
    width: width - 30,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    color: '#fa709a',
    marginBottom: 30,
    fontWeight: '600',
  },
  emptyButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  patientCard: {
    borderRadius: 25,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(250, 112, 154, 0.1)',
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  patientAge: {
    fontSize: 15,
    color: '#fa709a',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  patientDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
  },
  detailText: {
    fontSize: 15,
    color: '#4a5568',
    flex: 1,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(250, 112, 154, 0.1)',
    gap: 10,
  },
  actionButtonWrapper: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  actionButton: {
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width - 40,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalForm: {
    padding: 20,
    paddingTop: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 112, 154, 0.05)',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(250, 112, 154, 0.1)',
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1a1a2e',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    gap: 15,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PatientsScreen;