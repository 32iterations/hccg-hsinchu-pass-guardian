import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: string;
  patient_name?: string;
  status?: string;
}

interface Geofence {
  id: number;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius: number;
  alert_on_exit: boolean;
  alert_on_enter: boolean;
}

interface LeafletMapProps {
  locations: Location[];
  geofences: Geofence[];
  onMapReady?: () => void;
  onLocationUpdate?: (location: Location) => void;
  onGeofenceCreate?: (geofence: Omit<Geofence, 'id'>) => void;
  mode: 'realtime' | 'geofence';
  currentLocation?: Location;
}

const LeafletMap: React.FC<LeafletMapProps> = ({
  locations,
  geofences,
  onMapReady,
  onLocationUpdate,
  onGeofenceCreate,
  mode,
  currentLocation
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // 新竹市中心坐標
  const HSINCHU_CENTER = { lat: 24.8074, lng: 120.98175 };

  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>新竹護照監護人 - ${mode === 'realtime' ? '即時定位' : '地理圍欄'}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        #map {
            height: 100vh;
            width: 100vw;
        }
        .patient-marker {
            width: 20px;
            height: 20px;
            background-color: #3b82f6;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
            transition: all 0.3s ease;
        }
        .patient-marker.warning {
            background-color: #f97316;
            box-shadow: 0 0 15px rgba(249, 115, 22, 1);
        }
        .patient-marker.alert {
            background-color: #ef4444;
            box-shadow: 0 0 20px rgba(239, 68, 68, 1);
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        .home-marker {
            width: 24px;
            height: 24px;
            background-color: #10b981;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .destination-marker {
            width: 24px;
            height: 24px;
            background-color: #ef4444;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .geofence-marker {
            width: 16px;
            height: 16px;
            background-color: #8b5cf6;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
    </style>
</head>
<body>
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // 全局變數
        let map;
        let patientMarkers = [];
        let geofenceMarkers = [];
        let geofenceCircles = [];
        let pathPolylines = [];

        // 新竹市預設地點
        const hsinchuLocations = {
            home: [24.8113, 120.9715],
            center: [${HSINCHU_CENTER.lat}, ${HSINCHU_CENTER.lng}],
            hospital: [24.8146, 120.9685],
            park: [24.8091, 120.9811],
            market: [24.8035, 120.9920]
        };

        // 初始化地圖
        function initMap() {
            map = L.map('map', {
                center: [${HSINCHU_CENTER.lat}, ${HSINCHU_CENTER.lng}],
                zoom: 15,
                zoomControl: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                touchZoom: true
            });

            // 添加OpenStreetMap圖層
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // 地圖載入完成通知
            map.whenReady(() => {
                console.log('Map ready');
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'MAP_READY'
                }));
            });

            // 地圖點擊事件（用於圍欄創建）
            if ('${mode}' === 'geofence') {
                map.on('click', function(e) {
                    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'MAP_CLICK',
                        data: {
                            latitude: e.latlng.lat,
                            longitude: e.latlng.lng
                        }
                    }));
                });
            }
        }

        // 更新患者位置
        function updatePatientLocations(locations) {
            // 清除舊標記
            patientMarkers.forEach(marker => map.removeLayer(marker));
            pathPolylines.forEach(polyline => map.removeLayer(polyline));
            patientMarkers = [];
            pathPolylines = [];

            if (!locations || locations.length === 0) return;

            // 創建路徑
            if (locations.length > 1) {
                const pathCoords = locations.map(loc => [loc.latitude, loc.longitude]);
                const pathPolyline = L.polyline(pathCoords, {
                    color: '#3b82f6',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '5, 10'
                }).addTo(map);
                pathPolylines.push(pathPolyline);
            }

            // 添加患者標記
            locations.forEach((location, index) => {
                const isLatest = index === locations.length - 1;
                const markerClass = location.status === 'alert' ? 'alert' :
                                  location.status === 'warning' ? 'warning' : '';

                const marker = L.marker([location.latitude, location.longitude], {
                    icon: L.divIcon({
                        className: \`patient-marker \${markerClass}\`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);

                // 最新位置的彈窗
                if (isLatest) {
                    const time = location.timestamp ?
                        new Date(location.timestamp).toLocaleTimeString('zh-TW') :
                        new Date().toLocaleTimeString('zh-TW');

                    marker.bindPopup(\`
                        <div style="font-family: sans-serif;">
                            <strong>\${location.patient_name || '患者'}</strong><br>
                            <small>最後更新: \${time}</small><br>
                            <small>狀態: \${location.status || '正常'}</small>
                        </div>
                    \`).openPopup();

                    // 地圖中心移至最新位置
                    map.setView([location.latitude, location.longitude], map.getZoom());
                }

                patientMarkers.push(marker);
            });
        }

        // 更新地理圍欄
        function updateGeofences(geofences) {
            // 清除舊圍欄
            geofenceMarkers.forEach(marker => map.removeLayer(marker));
            geofenceCircles.forEach(circle => map.removeLayer(circle));
            geofenceMarkers = [];
            geofenceCircles = [];

            if (!geofences || geofences.length === 0) return;

            geofences.forEach(geofence => {
                // 圍欄圓圈
                const circle = L.circle([geofence.center_latitude, geofence.center_longitude], {
                    color: geofence.alert_on_exit ? '#ef4444' : '#3b82f6',
                    fillColor: geofence.alert_on_exit ? '#ef4444' : '#3b82f6',
                    fillOpacity: 0.1,
                    radius: geofence.radius,
                    weight: 2
                }).addTo(map);

                // 圍欄中心標記
                const marker = L.marker([geofence.center_latitude, geofence.center_longitude], {
                    icon: L.divIcon({
                        className: 'geofence-marker',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map);

                const alertType = geofence.alert_on_exit ? '離開警報' :
                                geofence.alert_on_enter ? '進入警報' : '無警報';

                marker.bindPopup(\`
                    <div style="font-family: sans-serif;">
                        <strong>\${geofence.name}</strong><br>
                        <small>半徑: \${geofence.radius}公尺</small><br>
                        <small>警報類型: \${alertType}</small>
                    </div>
                \`);

                geofenceMarkers.push(marker);
                geofenceCircles.push(circle);
            });
        }

        // 添加新竹市重要地標
        function addHsinchuLandmarks() {
            // 新竹火車站
            L.marker([24.8016, 120.9714], {
                icon: L.divIcon({
                    className: 'destination-marker',
                    html: '🚉',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map).bindPopup('<strong>新竹火車站</strong>');

            // 新竹市政府
            L.marker([24.8038, 120.9713], {
                icon: L.divIcon({
                    className: 'destination-marker',
                    html: '🏛️',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map).bindPopup('<strong>新竹市政府</strong>');

            // 東門城
            L.marker([24.8016, 120.9672], {
                icon: L.divIcon({
                    className: 'destination-marker',
                    html: '🏰',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map).bindPopup('<strong>新竹東門城</strong>');
        }

        // 重新置中地圖
        function recenterMap() {
            if (patientMarkers.length > 0) {
                const latestMarker = patientMarkers[patientMarkers.length - 1];
                map.setView(latestMarker.getLatLng(), 16);
            } else {
                map.setView([${HSINCHU_CENTER.lat}, ${HSINCHU_CENTER.lng}], 15);
            }
        }

        // 監聽來自React Native的消息
        window.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);

            switch(data.type) {
                case 'UPDATE_LOCATIONS':
                    updatePatientLocations(data.locations);
                    break;
                case 'UPDATE_GEOFENCES':
                    updateGeofences(data.geofences);
                    break;
                case 'RECENTER':
                    recenterMap();
                    break;
            }
        });

        // 初始化
        document.addEventListener('DOMContentLoaded', function() {
            initMap();
            addHsinchuLandmarks();
        });
    </script>
</body>
</html>`;

  useEffect(() => {
    if (isMapReady && locations.length > 0) {
      sendToWebView('UPDATE_LOCATIONS', locations);
    }
  }, [locations, isMapReady]);

  useEffect(() => {
    if (isMapReady && geofences.length > 0) {
      sendToWebView('UPDATE_GEOFENCES', geofences);
    }
  }, [geofences, isMapReady]);

  const sendToWebView = (type: string, data?: any) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ type, ...data });
      webViewRef.current.postMessage(message);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'MAP_READY':
          setIsMapReady(true);
          onMapReady?.();
          break;
        case 'MAP_CLICK':
          if (mode === 'geofence' && onGeofenceCreate) {
            // 在圍欄模式下，地圖點擊可以觸發圍欄創建
            console.log('Map clicked:', message.data);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const recenterMap = () => {
    sendToWebView('RECENTER');
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onError={(error) => console.error('WebView error:', error)}
        onHttpError={(error) => console.error('WebView HTTP error:', error)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default LeafletMap;