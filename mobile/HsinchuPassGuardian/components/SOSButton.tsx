import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, EMERGENCY_CONFIG } from '../config';

interface SOSButtonProps {
  patientId: number;
  token: string;
  onSOS?: () => void;
}

const SOSButton: React.FC<SOSButtonProps> = ({ patientId, token, onSOS }) => {
  const [pressing, setPressing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sosActive, setSOSActive] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  let pressTimer: NodeJS.Timeout | null = null;
  let countdownTimer: NodeJS.Timeout | null = null;

  useEffect(() => {
    // Get current location when component mounts
    getCurrentLocation();
  }, []);

  useEffect(() => {
    return () => {
      if (pressTimer) clearTimeout(pressTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const handlePressIn = () => {
    setPressing(true);
    setCountdown(3);

    // Start countdown
    let count = 3;
    countdownTimer = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count === 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        triggerSOS();
      }
    }, 1000);

    // Vibrate pattern for feedback
    Vibration.vibrate([0, 100, 100, 100]);
  };

  const handlePressOut = () => {
    setPressing(false);
    setCountdown(0);

    // Clear timers
    if (pressTimer) clearTimeout(pressTimer);
    if (countdownTimer) clearInterval(countdownTimer);

    // Stop vibration
    Vibration.cancel();
  };

  const triggerSOS = async () => {
    setSOSActive(true);
    setPressing(false);

    // Strong vibration for SOS activation
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    // Get fresh location
    getCurrentLocation();

    // Show message modal
    setShowMessageModal(true);
  };

  const sendSOSAlert = async (message?: string) => {
    setSending(true);
    setShowMessageModal(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/emergency/sos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: patientId,
          latitude: location?.lat || 0,
          longitude: location?.lng || 0,
          message: message || EMERGENCY_CONFIG.SOS_MESSAGE,
          battery_level: batteryLevel,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          '🚨 緊急求救已發送',
          `已通知 ${data.notified_contacts} 位緊急聯絡人\n位置: ${location?.lat.toFixed(6)}, ${location?.lng.toFixed(6)}`,
          [
            {
              text: '確定',
              onPress: () => {
                setSOSActive(false);
                if (onSOS) onSOS();
              },
            },
          ]
        );

        // Store SOS history
        const sosHistory = await AsyncStorage.getItem('sos_history');
        const history = sosHistory ? JSON.parse(sosHistory) : [];
        history.push({
          timestamp: new Date().toISOString(),
          location,
          message: message || EMERGENCY_CONFIG.SOS_MESSAGE,
        });
        await AsyncStorage.setItem('sos_history', JSON.stringify(history));
      } else {
        throw new Error('Failed to send SOS');
      }
    } catch (error) {
      console.error('SOS error:', error);
      Alert.alert(
        '錯誤',
        '無法發送緊急求救，請直接撥打緊急電話',
        [
          { text: '撥打 110', onPress: () => callEmergency('110') },
          { text: '撥打 119', onPress: () => callEmergency('119') },
          { text: '取消', style: 'cancel' },
        ]
      );
    } finally {
      setSending(false);
      setSOSActive(false);
    }
  };

  const callEmergency = (number: string) => {
    // In a real app, this would use Linking.openURL(`tel:${number}`)
    Alert.alert('撥打緊急電話', `撥打 ${number}`);
  };

  const cancelSOS = () => {
    setShowMessageModal(false);
    setSOSActive(false);
    setCustomMessage('');
    Vibration.cancel();
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.sosButton,
            pressing && styles.sosButtonPressing,
            sosActive && styles.sosButtonActive,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={sosActive || sending}
          activeOpacity={0.8}
        >
          <Text style={styles.sosText}>SOS</Text>
          {pressing && countdown > 0 && (
            <Text style={styles.countdownText}>{countdown}</Text>
          )}
          {sosActive && (
            <Text style={styles.activeText}>緊急求救中</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.instructionText}>
          長按 3 秒啟動緊急求救
        </Text>
      </View>

      {/* Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚨 緊急求救</Text>

            <Text style={styles.modalText}>
              位置: {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : '獲取中...'}
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder="輸入緊急訊息（選填）"
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
              numberOfLines={3}
            />

            <View style={styles.quickMessages}>
              <TouchableOpacity
                style={styles.quickMessageButton}
                onPress={() => setCustomMessage('我迷路了，需要協助')}
              >
                <Text style={styles.quickMessageText}>迷路</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickMessageButton}
                onPress={() => setCustomMessage('我感到不適，需要醫療協助')}
              >
                <Text style={styles.quickMessageText}>不適</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickMessageButton}
                onPress={() => setCustomMessage('我跌倒了，無法起身')}
              >
                <Text style={styles.quickMessageText}>跌倒</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.sendButton]}
                onPress={() => sendSOSAlert(customMessage)}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>發送求救</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelSOS}
                disabled={sending}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sosButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  sosButtonPressing: {
    backgroundColor: '#d32f2f',
    transform: [{ scale: 0.95 }],
  },
  sosButtonActive: {
    backgroundColor: '#ff6b6b',
  },
  sosText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
  },
  countdownText: {
    position: 'absolute',
    bottom: 30,
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  activeText: {
    position: 'absolute',
    bottom: 30,
    fontSize: 14,
    color: 'white',
  },
  instructionText: {
    marginTop: 20,
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  quickMessages: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    marginBottom: 20,
  },
  quickMessageButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickMessageText: {
    fontSize: 12,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  sendButton: {
    backgroundColor: '#f44336',
  },
  cancelButton: {
    backgroundColor: '#9e9e9e',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SOSButton;