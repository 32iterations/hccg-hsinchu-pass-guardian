import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import ApiService from '../services/api';

interface Scenario {
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

interface SimulationPosition {
  latitude: number;
  longitude: number;
  status: string;
  alert?: string;
  address?: string;
  speed?: number;
  battery?: number;
}

const SimulationScreen = ({ navigation }: any) => {
  const mapRef = useRef<MapView>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<SimulationPosition | null>(null);
  const [trajectory, setTrajectory] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadScenarios();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (simulationId) {
        ApiService.stopSimulation(simulationId);
      }
    };
  }, []);

  const loadScenarios = async () => {
    setIsLoading(true);
    try {
      const result = await ApiService.getSimulationScenarios();
      if (result.success && result.scenarios) {
        setScenarios(result.scenarios);
      } else {
        Alert.alert('錯誤', '無法載入模擬場景');
      }
    } catch (error) {
      console.error('Load scenarios error:', error);
      Alert.alert('錯誤', '無法連接到伺服器');
    } finally {
      setIsLoading(false);
    }
  };

  const startSimulation = async (scenario: Scenario) => {
    if (isRunning) {
      stopSimulation();
      return;
    }

    setIsLoading(true);
    try {
      const result = await ApiService.startSimulation(
        scenario.id,
        scenario.patient.id.toString(),
        2 // 2x speed
      );

      if (result.success && result.simulationId) {
        setSimulationId(result.simulationId);
        setSelectedScenario(scenario);
        setIsRunning(true);
        setTrajectory([]);

        // Start polling for position updates
        intervalRef.current = setInterval(() => {
          updateSimulationPosition(result.simulationId);
        }, 2000); // Update every 2 seconds
      } else {
        Alert.alert('錯誤', '無法開始模擬');
      }
    } catch (error) {
      console.error('Start simulation error:', error);
      Alert.alert('錯誤', '無法開始模擬');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSimulationPosition = async (simId: string) => {
    try {
      const result = await ApiService.getSimulationPosition(simId);
      if (result.success && result.position) {
        setCurrentPosition(result.position);
        setTrajectory(prev => [...prev, {
          latitude: result.position.latitude,
          longitude: result.position.longitude,
        }]);

        // Center map on current position
        mapRef.current?.animateToRegion({
          latitude: result.position.latitude,
          longitude: result.position.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });

        // Show alert if there's one
        if (result.position.alert) {
          let alertTitle = '⚠️ 警報';
          let alertMessage = '';

          switch (result.position.alert) {
            case 'geofence_exit':
              alertTitle = '🚨 離開安全區域';
              alertMessage = '患者已離開地理圍欄範圍';
              break;
            case 'no_movement':
              alertTitle = '⏸️ 無移動';
              alertMessage = '患者超過30分鐘未移動';
              break;
            case 'emergency_sos':
              alertTitle = '🆘 緊急求救';
              alertMessage = '患者按下SOS按鈕！';
              break;
            default:
              alertMessage = result.position.alert;
          }

          Alert.alert(alertTitle, alertMessage);
        }

        // Check if simulation is completed
        if (result.simulation && result.simulation.status === 'completed') {
          stopSimulation();
          Alert.alert('模擬完成', `${selectedScenario?.name} 場景已完成`);
        }
      }
    } catch (error) {
      console.error('Update position error:', error);
    }
  };

  const stopSimulation = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (simulationId) {
      await ApiService.stopSimulation(simulationId);
      setSimulationId(null);
    }

    setIsRunning(false);
  };

  const renderScenario = ({ item }: { item: Scenario }) => (
    <TouchableOpacity
      style={[
        styles.scenarioCard,
        selectedScenario?.id === item.id && styles.selectedCard
      ]}
      onPress={() => startSimulation(item)}
    >
      <View style={styles.scenarioHeader}>
        <Text style={styles.scenarioName}>{item.name}</Text>
        <Text style={styles.scenarioDuration}>{item.duration}</Text>
      </View>
      <Text style={styles.scenarioDescription}>{item.description}</Text>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>
          👤 {item.patient.name} ({item.patient.age}歲)
        </Text>
        <Text style={styles.patientCondition}>
          狀況: {item.patient.condition}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'normal': return '#4CAF50';
      case 'wandering': return '#FFC107';
      case 'lost': return '#F44336';
      case 'found': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: 24.8066,
            longitude: 120.9686,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {currentPosition && (
            <Marker
              coordinate={{
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude,
              }}
              title={selectedScenario?.patient.name}
              description={currentPosition.address || '移動中'}
            >
              <View style={[styles.markerContainer, { backgroundColor: getStatusColor(currentPosition.status) }]}>
                <Text style={styles.markerText}>👤</Text>
              </View>
            </Marker>
          )}

          {trajectory.length > 1 && (
            <Polyline
              coordinates={trajectory}
              strokeColor={getStatusColor(currentPosition?.status)}
              strokeWidth={3}
            />
          )}
        </MapView>

        {currentPosition && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>
              狀態: {currentPosition.status || '正常'}
            </Text>
            {currentPosition.speed !== undefined && (
              <Text style={styles.statusText}>
                速度: {currentPosition.speed.toFixed(1)} km/h
              </Text>
            )}
            {currentPosition.battery !== undefined && (
              <Text style={styles.statusText}>
                電量: {currentPosition.battery}%
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.controlPanel}>
        <Text style={styles.title}>模擬場景</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : (
          <FlatList
            data={scenarios}
            renderItem={renderScenario}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scenarioList}
          />
        )}

        {isRunning && (
          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={stopSimulation}
          >
            <Text style={styles.buttonText}>停止模擬</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapContainer: {
    flex: 2,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statusText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  controlPanel: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  scenarioList: {
    paddingVertical: 10,
  },
  scenarioCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 15,
    marginRight: 15,
    width: 250,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCard: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: '#e3f2fd',
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  scenarioDuration: {
    fontSize: 12,
    color: '#666',
  },
  scenarioDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  patientInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  patientName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 3,
  },
  patientCondition: {
    fontSize: 12,
    color: '#999',
  },
  controlButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markerContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    fontSize: 16,
  },
});

export default SimulationScreen;