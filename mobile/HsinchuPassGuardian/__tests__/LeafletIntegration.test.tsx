import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import LeafletRealTimeMapScreen from '../src/screens/LeafletRealTimeMapScreen';
import LeafletRealGeofenceScreen from '../src/screens/LeafletRealGeofenceScreen';
import apiService from '../services/api';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('../services/api', () => ({
  getPatients: jest.fn(),
  getLocationHistory: jest.fn(),
  checkGeofences: jest.fn(),
  getGeofences: jest.fn(),
  createGeofence: jest.fn(),
  updateGeofence: jest.fn(),
  deleteGeofence: jest.fn(),
}));

jest.mock('../components/LeafletMap', () => 'LeafletMap');

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('Leaflet Integration Tests - TDD', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute = {
    params: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('fake-token');
  });

  describe('LeafletRealTimeMapScreen Integration', () => {
    const mockPatients = [
      { id: 1, name: '張三', age: 75, gender: 'male', guardian_id: 1 },
      { id: 2, name: '李四', age: 82, gender: 'female', guardian_id: 1 },
    ];

    const mockLocations = [
      {
        id: 1,
        patient_id: 1,
        latitude: 24.8074,
        longitude: 120.98175,
        timestamp: '2024-12-20T10:00:00Z',
      },
    ];

    beforeEach(() => {
      apiService.getPatients.mockResolvedValue({
        success: true,
        patients: mockPatients,
      });

      apiService.getLocationHistory.mockResolvedValue({
        success: true,
        locations: mockLocations,
      });

      apiService.checkGeofences.mockResolvedValue({
        success: true,
        alerts: [],
      });
    });

    it('should load patients on mount', async () => {
      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        expect(apiService.getPatients).toHaveBeenCalled();
      });
    });

    it('should auto-select first patient', async () => {
      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        expect(apiService.getLocationHistory).toHaveBeenCalledWith(1);
      });
    });

    it('should handle network disconnection', async () => {
      let networkCallback;
      NetInfo.addEventListener.mockImplementation((cb) => {
        networkCallback = cb;
        return jest.fn();
      });

      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      // Simulate network disconnection
      networkCallback({ isConnected: false });

      await waitFor(() => {
        expect(getByText('⚠️ 網路連線中斷，顯示離線數據')).toBeTruthy();
      });
    });

    it('should refresh data on button press', async () => {
      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const refreshButton = getByText('🔄');
        fireEvent.press(refreshButton);
      });

      expect(apiService.getLocationHistory).toHaveBeenCalled();
    });

    it('should switch between patients', async () => {
      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const switchButton = getByText('切換');
        fireEvent.press(switchButton);
      });

      // Should load second patient's data
      expect(apiService.getLocationHistory).toHaveBeenCalledWith(2);
    });

    it('should display geofence alerts', async () => {
      apiService.checkGeofences.mockResolvedValue({
        success: true,
        alerts: [
          {
            geofence_name: '新竹火車站',
            alert_type: '離開警報',
          },
        ],
      });

      render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '地理圍欄警報',
          expect.stringContaining('新竹火車站')
        );
      });
    });

    it('should navigate to geofence screen', async () => {
      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const geofenceButton = getByText('🚧');
        fireEvent.press(geofenceButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Geofence');
    });

    it('should navigate to alerts screen', async () => {
      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const alertsButton = getByText('🚨');
        fireEvent.press(alertsButton);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Alerts');
    });
  });

  describe('LeafletRealGeofenceScreen Integration', () => {
    const mockGeofences = [
      {
        id: 1,
        name: '新竹市政府',
        center_latitude: 24.8038,
        center_longitude: 120.9713,
        radius: 150,
        alert_on_exit: true,
        alert_on_enter: false,
      },
    ];

    beforeEach(() => {
      apiService.getGeofences.mockResolvedValue({
        success: true,
        geofences: mockGeofences,
      });

      apiService.createGeofence.mockResolvedValue({
        success: true,
        geofence: { id: 2, ...mockGeofences[0] },
      });

      apiService.updateGeofence.mockResolvedValue({
        success: true,
      });

      apiService.deleteGeofence.mockResolvedValue({
        success: true,
      });
    });

    it('should load geofences on mount', async () => {
      const { getByText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        expect(apiService.getGeofences).toHaveBeenCalled();
      });
    });

    it('should create new geofence', async () => {
      const { getByText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const createButton = getByText('新增圍欄');
        fireEvent.press(createButton);
      });

      // Modal should appear
      expect(getByText('建立地理圍欄')).toBeTruthy();
    });

    it('should handle geofence creation with form data', async () => {
      apiService.createGeofence.mockResolvedValue({
        success: true,
        geofence: {
          id: 3,
          name: 'Test Geofence',
          center_latitude: 24.8074,
          center_longitude: 120.98175,
          radius: 100,
          alert_on_exit: false,
          alert_on_enter: true,
        },
      });

      const { getByText, getByPlaceholderText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const createButton = getByText('新增圍欄');
        fireEvent.press(createButton);
      });

      // Fill form
      const nameInput = getByPlaceholderText('輸入圍欄名稱');
      fireEvent.changeText(nameInput, 'Test Geofence');

      const saveButton = getByText('儲存');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(apiService.createGeofence).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Geofence',
          })
        );
      });
    });

    it('should edit existing geofence', async () => {
      const { getAllByText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const editButtons = getAllByText('編輯');
        fireEvent.press(editButtons[0]);
      });

      // Should call update API
      await waitFor(() => {
        expect(apiService.updateGeofence).toHaveBeenCalled();
      });
    });

    it('should delete geofence with confirmation', async () => {
      Alert.alert.mockImplementation((title, message, buttons) => {
        // Simulate pressing "確定" (confirm)
        buttons[1].onPress();
      });

      const { getAllByText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const deleteButtons = getAllByText('刪除');
        fireEvent.press(deleteButtons[0]);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        '確認刪除',
        expect.any(String),
        expect.any(Array)
      );

      await waitFor(() => {
        expect(apiService.deleteGeofence).toHaveBeenCalledWith(1);
      });
    });

    it('should navigate back on back button press', async () => {
      const { getByText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const backButton = getByText('←');
        fireEvent.press(backButton);
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    it('should show recommendations modal', async () => {
      const { getByText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const recommendButton = getByText('推薦地點');
        fireEvent.press(recommendButton);
      });

      // Should show Hsinchu locations
      expect(getByText('新竹火車站')).toBeTruthy();
      expect(getByText('新竹市政府')).toBeTruthy();
      expect(getByText('東門城')).toBeTruthy();
    });

    it('should apply recommended location', async () => {
      const { getByText, getByPlaceholderText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      // Open create modal
      await waitFor(() => {
        const createButton = getByText('新增圍欄');
        fireEvent.press(createButton);
      });

      // Open recommendations
      const recommendButton = getByText('推薦地點');
      fireEvent.press(recommendButton);

      // Select a recommendation
      const stationButton = getByText('新竹火車站');
      fireEvent.press(stationButton);

      // Check if form was filled
      const nameInput = getByPlaceholderText('輸入圍欄名稱');
      expect(nameInput.props.value).toBe('新竹火車站');
    });
  });

  describe('Error Handling', () => {
    it('should handle API failure gracefully', async () => {
      apiService.getPatients.mockRejectedValue(new Error('Network error'));

      const { getByText } = render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '錯誤',
          '初始化失敗，請檢查網路連線'
        );
      });
    });

    it('should handle geofence creation failure', async () => {
      apiService.createGeofence.mockRejectedValue(new Error('Server error'));

      const { getByText, getByPlaceholderText } = render(
        <LeafletRealGeofenceScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        const createButton = getByText('新增圍欄');
        fireEvent.press(createButton);
      });

      const nameInput = getByPlaceholderText('輸入圍欄名稱');
      fireEvent.changeText(nameInput, 'Test');

      const saveButton = getByText('儲存');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '錯誤',
          expect.any(String)
        );
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple location updates efficiently', async () => {
      const largeLocationSet = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        patient_id: 1,
        latitude: 24.8074 + i * 0.001,
        longitude: 120.98175 + i * 0.001,
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
      }));

      apiService.getLocationHistory.mockResolvedValue({
        success: true,
        locations: largeLocationSet,
      });

      const startTime = performance.now();

      render(
        <LeafletRealTimeMapScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      );

      await waitFor(() => {
        expect(apiService.getLocationHistory).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (3 seconds)
      expect(renderTime).toBeLessThan(3000);
    });
  });
});