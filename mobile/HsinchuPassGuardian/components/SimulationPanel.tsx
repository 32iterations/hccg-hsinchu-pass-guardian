import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import ApiService from '../src/services/api';

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  patient: {
    id: number;
    name: string;
    age: number;
    condition: string;
  };
  duration: string;
}

interface SimulationPanelProps {
  onSimulationStart: (simulationId: string) => void;
  onSimulationStop: () => void;
  onLocationUpdate: (location: any) => void;
  isSimulating: boolean;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({
  onSimulationStart,
  onSimulationStop,
  onLocationUpdate,
  isSimulating,
}) => {
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [currentSimulation, setCurrentSimulation] = useState<string | null>(null);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [simulationStatus, setSimulationStatus] = useState<string>('停止');
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [updateInterval, setUpdateInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadScenarios();
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, []);

  const loadScenarios = async () => {
    try {
      const result = await ApiService.getSimulationScenarios();
      if (result.success && result.scenarios) {
        setScenarios(result.scenarios);
        if (result.scenarios.length > 0) {
          setSelectedScenario(result.scenarios[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error);
      // 使用預設場景
      const defaultScenarios = [
        {
          id: 'scenario1',
          name: '早晨散步迷路',
          description: '王大明早上出門散步，在東門市場附近迷路',
          patient: {
            id: 1,
            name: '王大明',
            age: 75,
            condition: '輕度失智',
          },
          duration: '50 分鐘',
        },
        {
          id: 'scenario2',
          name: '就醫後迷失方向',
          description: '李小美看完醫生後，在醫院附近迷失方向',
          patient: {
            id: 2,
            name: '李小美',
            age: 68,
            condition: '中度失智',
          },
          duration: '45 分鐘',
        },
        {
          id: 'scenario3',
          name: '夜市走失',
          description: '張志強在城隍廟附近夜市走失',
          patient: {
            id: 3,
            name: '張志強',
            age: 72,
            condition: '輕度失智',
          },
          duration: '45 分鐘',
        },
      ];
      setScenarios(defaultScenarios);
      setSelectedScenario('scenario1');
    }
  };

  const startSimulation = async () => {
    if (!selectedScenario) {
      Alert.alert('錯誤', '請選擇模擬場景');
      return;
    }

    try {
      const result = await ApiService.startSimulation(
        selectedScenario,
        simulationSpeed
      );

      if (result.success && result.simulationId) {
        setCurrentSimulation(result.simulationId);
        setSimulationStatus('運行中');
        onSimulationStart(result.simulationId);

        // 開始定期更新位置
        const interval = setInterval(async () => {
          await updateSimulationLocation(result.simulationId);
        }, 3000); // 每3秒更新一次

        setUpdateInterval(interval);

        Alert.alert('成功', `模擬 "${result.scenario}" 已開始`);
      }
    } catch (error) {
      console.error('Failed to start simulation:', error);
      Alert.alert('錯誤', '無法開始模擬');
    }
  };

  const updateSimulationLocation = async (simulationId: string) => {
    try {
      const result = await ApiService.getSimulationStatus(simulationId);

      if (result.success && result.position) {
        setCurrentLocation(result.position);
        onLocationUpdate(result.position);

        // 檢查是否有警報
        if (result.position.alert) {
          handleSimulationAlert(result.position.alert);
        }

        // 如果模擬完成，停止更新
        if (result.simulation?.status === 'completed') {
          stopSimulation();
          Alert.alert('模擬完成', '患者路線模擬已完成');
        }
      }
    } catch (error) {
      console.error('Failed to update simulation location:', error);
    }
  };

  const handleSimulationAlert = (alertType: string) => {
    switch (alertType) {
      case 'geofence_exit':
        Alert.alert('⚠️ 地理圍欄警報', '患者已離開安全區域');
        break;
      case 'no_movement':
        Alert.alert('⚠️ 無移動警報', '患者長時間未移動');
        break;
      case 'emergency_sos':
        Alert.alert('🆘 緊急求救', '患者發出緊急求救信號');
        break;
    }
  };

  const stopSimulation = async () => {
    if (currentSimulation) {
      try {
        await ApiService.stopSimulation(currentSimulation);

        if (updateInterval) {
          clearInterval(updateInterval);
          setUpdateInterval(null);
        }

        setCurrentSimulation(null);
        setSimulationStatus('停止');
        setCurrentLocation(null);
        onSimulationStop();

        Alert.alert('成功', '模擬已停止');
      } catch (error) {
        console.error('Failed to stop simulation:', error);
      }
    }
  };

  const speedOptions = [
    { label: '慢速', value: 0.5 },
    { label: '正常', value: 1 },
    { label: '快速', value: 2 },
    { label: '極速', value: 5 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚶 位置模擬</Text>

      {/* 場景選擇 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>選擇模擬場景：</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {scenarios.map((scenario) => (
            <TouchableOpacity
              key={scenario.id}
              style={[
                styles.scenarioCard,
                selectedScenario === scenario.id && styles.selectedScenario,
              ]}
              onPress={() => setSelectedScenario(scenario.id)}
              disabled={isSimulating}
            >
              <Text style={styles.scenarioName}>{scenario.name}</Text>
              <Text style={styles.scenarioDesc}>{scenario.description}</Text>
              <Text style={styles.scenarioPatient}>
                {scenario.patient.name} ({scenario.patient.age}歲)
              </Text>
              <Text style={styles.scenarioDuration}>時長: {scenario.duration}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 速度控制 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>模擬速度：</Text>
        <View style={styles.speedContainer}>
          {speedOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.speedButton,
                simulationSpeed === option.value && styles.selectedSpeed,
              ]}
              onPress={() => setSimulationSpeed(option.value)}
              disabled={isSimulating}
            >
              <Text
                style={[
                  styles.speedText,
                  simulationSpeed === option.value && styles.selectedSpeedText,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 控制按鈕 */}
      <View style={styles.controlContainer}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            isSimulating ? styles.stopButton : styles.startButton,
          ]}
          onPress={isSimulating ? stopSimulation : startSimulation}
        >
          <Text style={styles.controlButtonText}>
            {isSimulating ? '停止模擬' : '開始模擬'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 即時資訊 */}
      {currentLocation && (
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📊 即時資訊</Text>
          <Text style={styles.infoText}>
            緯度：{currentLocation.latitude?.toFixed(6) || 'N/A'}
          </Text>
          <Text style={styles.infoText}>
            經度：{currentLocation.longitude?.toFixed(6) || 'N/A'}
          </Text>
          <Text style={styles.infoText}>
            速度：{currentLocation.speed?.toFixed(1) || '0'} km/h
          </Text>
          <Text style={styles.infoText}>
            電量：{currentLocation.battery || '100'}%
          </Text>
          <Text style={styles.infoText}>
            狀態：{currentLocation.status === 'lost' ? '迷路' :
                  currentLocation.status === 'wandering' ? '徘徊' :
                  currentLocation.status === 'found' ? '已找到' : '正常'}
          </Text>
        </View>
      )}

      {/* 狀態指示器 */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusIndicator,
            isSimulating ? styles.statusActive : styles.statusInactive,
          ]}
        />
        <Text style={styles.statusText}>
          模擬狀態：{simulationStatus}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 15,
    margin: 10,
    elevation: 5,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  scenarioCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    width: 200,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedScenario: {
    borderColor: '#667eea',
    backgroundColor: '#F0F3FF',
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  scenarioDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  scenarioPatient: {
    fontSize: 12,
    color: '#888',
    marginBottom: 3,
  },
  scenarioDuration: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  speedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  speedButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 5,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedSpeed: {
    backgroundColor: '#667eea',
  },
  speedText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedSpeedText: {
    color: '#FFF',
  },
  controlContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  controlButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  controlButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#CCC',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
});

export default SimulationPanel;