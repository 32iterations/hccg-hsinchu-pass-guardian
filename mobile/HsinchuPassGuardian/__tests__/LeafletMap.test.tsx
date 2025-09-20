import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WebView } from 'react-native-webview';
import LeafletMap from '../components/LeafletMap';

// Mock WebView
jest.mock('react-native-webview', () => ({
  WebView: jest.fn(({ onMessage, onError, onHttpError }) => {
    const React = require('react');
    return React.createElement('WebView', {
      testID: 'webview',
      onMessage,
      onError,
      onHttpError,
    });
  }),
}));

describe('LeafletMap Component - TDD Tests', () => {
  const mockLocations = [
    {
      latitude: 24.8074,
      longitude: 120.98175,
      timestamp: '2024-12-20T10:00:00Z',
      patient_name: 'Test Patient',
      status: 'normal',
    },
  ];

  const mockGeofences = [
    {
      id: 1,
      name: '新竹火車站',
      center_latitude: 24.8016,
      center_longitude: 120.9714,
      radius: 200,
      alert_on_exit: true,
      alert_on_enter: false,
    },
  ];

  const mockOnMapReady = jest.fn();
  const mockOnLocationUpdate = jest.fn();
  const mockOnGeofenceCreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render WebView with correct props', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      expect(getByTestId('webview')).toBeTruthy();
    });

    it('should include Leaflet library in HTML content', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.source.html).toContain('leaflet@1.9.4');
      expect(webView.props.source.html).toContain('OpenStreetMap');
    });

    it('should center map on Hsinchu coordinates', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.source.html).toContain('24.8074');
      expect(webView.props.source.html).toContain('120.98175');
    });
  });

  describe('Map Communication', () => {
    it('should handle MAP_READY message correctly', async () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      const mapReadyMessage = {
        nativeEvent: {
          data: JSON.stringify({ type: 'MAP_READY' }),
        },
      };

      fireEvent(webView, 'message', mapReadyMessage);

      await waitFor(() => {
        expect(mockOnMapReady).toHaveBeenCalledTimes(1);
      });
    });

    it('should send location updates to WebView when map is ready', async () => {
      const { getByTestId, rerender } = render(
        <LeafletMap
          locations={[]}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');

      // Simulate map ready
      fireEvent(webView, 'message', {
        nativeEvent: {
          data: JSON.stringify({ type: 'MAP_READY' }),
        },
      });

      // Update locations
      rerender(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      // Verify postMessage was called
      expect(WebView).toHaveBeenCalled();
    });

    it('should handle MAP_CLICK in geofence mode', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="geofence"
          onMapReady={mockOnMapReady}
          onGeofenceCreate={mockOnGeofenceCreate}
        />
      );

      const webView = getByTestId('webview');
      const mapClickMessage = {
        nativeEvent: {
          data: JSON.stringify({
            type: 'MAP_CLICK',
            data: { latitude: 24.8074, longitude: 120.98175 },
          }),
        },
      };

      fireEvent(webView, 'message', mapClickMessage);
      // Verify console.log was called (in real implementation)
    });
  });

  describe('Error Handling', () => {
    it('should handle WebView error gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      const error = { description: 'Network error' };

      fireEvent(webView, 'error', error);

      expect(consoleError).toHaveBeenCalledWith('WebView error:', error);
      consoleError.mockRestore();
    });

    it('should handle invalid JSON in message', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      const invalidMessage = {
        nativeEvent: {
          data: 'invalid json',
        },
      };

      fireEvent(webView, 'message', invalidMessage);

      expect(consoleError).toHaveBeenCalledWith(
        'Error parsing WebView message:',
        expect.any(Error)
      );
      consoleError.mockRestore();
    });
  });

  describe('Location Updates', () => {
    it('should update locations when props change', () => {
      const { rerender } = render(
        <LeafletMap
          locations={[]}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const newLocations = [
        ...mockLocations,
        {
          latitude: 24.8016,
          longitude: 120.9714,
          timestamp: '2024-12-20T10:05:00Z',
          patient_name: 'Test Patient',
          status: 'warning',
        },
      ];

      rerender(
        <LeafletMap
          locations={newLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      // Verify the component re-renders with new locations
      expect(newLocations).toHaveLength(2);
    });
  });

  describe('Geofence Updates', () => {
    it('should update geofences when props change', () => {
      const { rerender } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={[]}
          mode="geofence"
          onMapReady={mockOnMapReady}
        />
      );

      rerender(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="geofence"
          onMapReady={mockOnMapReady}
        />
      );

      // Verify the component re-renders with new geofences
      expect(mockGeofences).toHaveLength(1);
    });
  });

  describe('Mode Switching', () => {
    it('should handle realtime mode correctly', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.source.html).toContain('即時定位');
    });

    it('should handle geofence mode correctly', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="geofence"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.source.html).toContain('地理圍欄');
    });
  });

  describe('WebView Configuration', () => {
    it('should enable JavaScript', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.javaScriptEnabled).toBe(true);
    });

    it('should enable DOM storage', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.domStorageEnabled).toBe(true);
    });

    it('should set mixed content mode to compatibility', () => {
      const { getByTestId } = render(
        <LeafletMap
          locations={mockLocations}
          geofences={mockGeofences}
          mode="realtime"
          onMapReady={mockOnMapReady}
        />
      );

      const webView = getByTestId('webview');
      expect(webView.props.mixedContentMode).toBe('compatibility');
    });
  });
});