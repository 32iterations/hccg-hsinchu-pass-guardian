import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
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
  mode: 'realtime' | 'geofence' | 'simulation';
  currentLocation?: Location;
  simulationMode?: boolean;
  showHeatmap?: boolean;
  onSimulationStart?: () => void;
  onSimulationStop?: () => void;
}

const LeafletMap = forwardRef((props: LeafletMapProps, ref: any) => {
  const {
    locations,
    geofences,
    onMapReady,
    onLocationUpdate,
    onGeofenceCreate,
    mode,
    currentLocation,
    simulationMode = false,
    showHeatmap = false,
    onSimulationStart,
    onSimulationStop
  } = props;
  const webViewRef = useRef<WebView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // 新竹市中心坐標
  const HSINCHU_CENTER = { lat: 24.8074, lng: 120.98175 };

  // 暴露方法給父組件使用
  useImperativeHandle(ref, () => ({
    startSimulation: () => {
      console.log('[LeafletMap] Starting simulation from imperative handle');
      sendToWebView('START_SIMULATION');
      onSimulationStart?.();
    },
    stopSimulation: () => {
      console.log('[LeafletMap] Stopping simulation from imperative handle');
      sendToWebView('STOP_SIMULATION');
      onSimulationStop?.();
    },
    toggleHeatmap: () => {
      console.log('[LeafletMap] Toggling heatmap from imperative handle');
      sendToWebView('TOGGLE_HEATMAP');
    },
    recenterMap: () => {
      console.log('[LeafletMap] Recentering map from imperative handle');
      sendToWebView('RECENTER');
    }
  }));

  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>新竹護照監護人 - ${mode === 'realtime' ? '即時定位' : mode === 'simulation' ? '模擬測試' : '地理圍欄'}</title>
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
        .simulation-marker {
            width: 24px;
            height: 24px;
            background-color: #8b5cf6;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.8);
            animation: bounce 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
        @keyframes ping {
            75%, 100% {
                transform: scale(2);
                opacity: 0;
            }
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
        .control-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            font-size: 12px;
        }
        .control-btn {
            background: #4f46e5;
            color: white;
            border: none;
            padding: 8px 12px;
            margin: 2px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        .control-btn:hover {
            background: #3730a3;
        }
        .control-btn.active {
            background: #059669;
        }
        .status-indicator {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            margin: 2px 0;
        }
        .status-indicator.simulation {
            background: #ddd6fe;
            color: #5b21b6;
        }
        .status-indicator.heatmap {
            background: #fef3c7;
            color: #92400e;
        }
        .probability-label {
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
    </style>
</head>
<body>
    <div id="map"></div>
    ${mode === 'simulation' ? `
    <div class="control-panel">
        <div>模擬控制</div>
        <button class="control-btn" onclick="startSimulation()">開始模擬</button>
        <button class="control-btn" onclick="stopSimulation()">停止模擬</button>
        <button class="control-btn" onclick="toggleHeatmap()">機率預測</button>
        <div class="status-indicator simulation" id="simStatus">等待開始</div>
        <div class="status-indicator heatmap" id="heatmapStatus">機率預測: 關閉</div>
    </div>
    ` : ''}

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // 全局變數
        let map;
        let patientMarkers = [];
        let geofenceMarkers = [];
        let geofenceCircles = [];
        let pathPolylines = [];
        let simulationMarkers = [];
        let heatmapLayer;
        let isSimulating = false;
        let simulationInterval;
        let heatmapData = [];
        let showingHeatmap = ${showHeatmap};
        let predictionPaths = [];
        let currentPatientLocation = null;
        let movementHistory = [];

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

        // 完整的患者移動模擬功能 - 強化版：確保沿著完整路徑移動
        function startSimulation() {
            if (isSimulating) return;
            isSimulating = true;

            // 重置所有狀態
            resetSimulationState();

            // 定義完整的從家到失智據點的路徑
            const homeCoords = [24.8113, 120.9715];    // 家 (起點)
            const destinationCoords = [24.8035, 120.9920]; // 失智據點 (目的地)

            // 📍 完整路徑：從家到失智據點的連續路線
            const completeJourneyPath = [
                // 第一部分：正常移動段 (從家出發)
                [24.8113, 120.9715], // 🏠 家 (起點)
                [24.8110, 120.9730], // 正常步行 1
                [24.8105, 120.9750], // 正常步行 2
                [24.8095, 120.9770], // 正常步行 3
                [24.8090, 120.9785], // 正常步行 4
                [24.8085, 120.9800], // 正常步行 5
                [24.8080, 120.9815], // ⚠️ 開始迷失的地點

                // 第二部分：異常徘徊段 (在迷失地點來回徘徊)
                [24.8075, 120.9820], // 開始遊蕩 1
                [24.8078, 120.9825], // 來回徘徊 1
                [24.8072, 120.9822], // 繼續徘徊 1
                [24.8076, 120.9827], // 重複路線 1
                [24.8074, 120.9823], // 更明顯的重複 1
                [24.8079, 120.9819], // 回到原點附近 1
                [24.8073, 120.9821], // 繼續徘徊 2
                [24.8077, 120.9826], // 🚨 警報觸發點

                // 第三部分：警報後繼續徘徊但逐漸遠離正確路徑
                [24.8070, 120.9830], // 警報後位置 1
                [24.8068, 120.9828], // 持續迷失 1
                [24.8071, 120.9832], // 持續迷失 2
                [24.8069, 120.9835], // 🚩 最終位置 (距離目的地很遠)
            ];

            // 定義階段分割點 (用於判斷當前處於哪個階段)
            const phaseBreakpoints = {
                normalEnd: 6,    // 前7個點 (0-6) 為正常階段
                suspiciousEnd: 15, // 第8-15個點 為異常徘徊階段
                alertEnd: completeJourneyPath.length - 1 // 剩餘點為警報階段
            };

            // 添加起點和終點標記
            addSimulationMarkers(homeCoords, destinationCoords);

            // 🛣️ 畫出完整預期路徑 (從家到失智據點的直線路徑)
            drawCompleteExpectedPath(homeCoords, destinationCoords);

            // 🛣️ 畫出實際將要行走的路徑 (顯示為虛線，表示計劃路線)
            drawPlannedPath(completeJourneyPath.slice(0, phaseBreakpoints.normalEnd + 1));

            document.getElementById('simStatus') && (document.getElementById('simStatus').textContent = '模擬中: 患者開始從家出發前往失智據點');

            let currentStep = 0;
            let simulationPhase = 'normal';
            let alertTriggered = false;

            // 🏃‍♀️ 開始模擬患者沿著完整路徑移動

            simulationInterval = setInterval(() => {
                if (currentStep >= completeJourneyPath.length) {
                    // 模擬完成，停止
                    document.getElementById('simStatus') && (document.getElementById('simStatus').textContent = '模擬完成：患者已迷失，距離目的地很遠');
                    setTimeout(() => stopSimulation(), 3000);
                    return;
                }

                // 📍 從完整路徑中取得當前位置
                let currentPos = completeJourneyPath[currentStep];
                let status = 'normal';
                let phase = 'normal';

                // 🎯 根據當前步驟判斷階段和狀態
                if (currentStep <= phaseBreakpoints.normalEnd) {
                    phase = 'normal';
                    status = 'normal';
                } else if (currentStep <= phaseBreakpoints.suspiciousEnd) {
                    phase = 'suspicious';
                    status = 'warning';
                } else {
                    phase = 'alert';
                    status = 'alert';
                }

                // 🔄 更新階段狀態和視覺提示
                if (simulationPhase !== phase) {
                    simulationPhase = phase;

                    switch (phase) {
                        case 'normal':
                            document.getElementById('simStatus') && (document.getElementById('simStatus').textContent = '模擬中: 患者正常移動前往失智據點');
                            updatePathStyle('normal');
                            break;
                        case 'suspicious':
                            document.getElementById('simStatus') && (document.getElementById('simStatus').textContent = '⚠️ 模擬中: 偵測到患者開始迷失，出現徘徊行為');
                            updatePathStyle('warning');
                            // 顯示徘徊警告
                            showWanderingAlert(currentPos);
                            break;
                        case 'alert':
                            document.getElementById('simStatus') && (document.getElementById('simStatus').textContent = '🚨 模擬中: 系統警報已觸發');
                            updatePathStyle('alert');
                            // 顯示系統警報
                            showSystemAlert(currentPos);
                            alertTriggered = true;
                            break;
                    }
                }

                currentStep++;

                // 更新患者標記
                updatePatientMarker(currentPos, status);

                // 更新移動歷史
                currentPatientLocation = {
                    lat: currentPos[0],
                    lng: currentPos[1],
                    timestamp: new Date(),
                    status: status
                };

                movementHistory.push(currentPatientLocation);
                if (movementHistory.length > 20) {
                    movementHistory = movementHistory.slice(-20);
                }

                // 畫出實際行走路徑
                if (movementHistory.length > 1) {
                    updateActualPath();
                }

                // 更新颱風路徑式機率預測
                if (showingHeatmap && simulationPhase === 'normal') {
                    updateTyphoonStylePrediction(currentPos, normalPath, currentStep);
                }

                // 通知React Native
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SIMULATION_UPDATE',
                    data: {
                        location: { latitude: currentPos[0], longitude: currentPos[1] },
                        timestamp: new Date().toISOString(),
                        status: status,
                        phase: simulationPhase
                    }
                }));

                // 地圖跟隨
                map.panTo(currentPos, { animate: true, duration: 0.5 });

            }, 2000); // 每2秒更新一次

            // 通知React Native模擬開始
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SIMULATION_STARTED'
            }));
        }

        function stopSimulation() {
            if (!isSimulating) return;
            isSimulating = false;

            if (simulationInterval) {
                clearInterval(simulationInterval);
            }

            // 清除所有模擬相關的標記和圖層
            clearSimulationLayers();

            document.getElementById('simStatus') && (document.getElementById('simStatus').textContent = '已停止');

            // 通知React Native模擬停止
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SIMULATION_STOPPED'
            }));
        }

        // 重置模擬狀態
        function resetSimulationState() {
            clearSimulationLayers();
            movementHistory = [];
            currentPatientLocation = null;
        }

        // 清除所有模擬圖層
        function clearSimulationLayers() {
            // 清除患者標記
            if (window.currentPatientMarker) {
                map.removeLayer(window.currentPatientMarker);
                window.currentPatientMarker = null;
            }

            // 清除起點終點標記
            if (window.homeMarker) {
                map.removeLayer(window.homeMarker);
                window.homeMarker = null;
            }
            if (window.destinationMarker) {
                map.removeLayer(window.destinationMarker);
                window.destinationMarker = null;
            }

            // 清除路徑線
            if (window.expectedPathLine) {
                map.removeLayer(window.expectedPathLine);
                window.expectedPathLine = null;
            }
            if (window.plannedPathLine) {
                map.removeLayer(window.plannedPathLine);
                window.plannedPathLine = null;
            }
            if (window.actualPathLine) {
                map.removeLayer(window.actualPathLine);
                window.actualPathLine = null;
            }
            if (window.normalPathLine) {
                map.removeLayer(window.normalPathLine);
                window.normalPathLine = null;
            }

            // 清除預測路徑
            clearPredictionPaths();

            // 清除警報標記
            if (window.alertMarker) {
                map.removeLayer(window.alertMarker);
                window.alertMarker = null;
            }
        }

        // 添加起點和終點標記
        function addSimulationMarkers(homeCoords, destinationCoords) {
            // 家的標記
            window.homeMarker = L.marker(homeCoords, {
                icon: L.divIcon({
                    className: 'home-marker',
                    html: '<div style="width: 24px; height: 24px; background-color: #10b981; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">🏠</div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                })
            }).addTo(map);
            window.homeMarker.bindPopup('<strong>家 (起點)</strong><br>患者開始移動的地方');

            // 失智據點的標記
            window.destinationMarker = L.marker(destinationCoords, {
                icon: L.divIcon({
                    className: 'destination-marker',
                    html: '<div style="width: 24px; height: 24px; background-color: #ef4444; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">🎯</div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                })
            }).addTo(map);
            window.destinationMarker.bindPopup('<strong>失智據點 (目的地)</strong><br>患者預計要到達的地方');
        }

        // 🛣️ 畫出完整預期路徑 (從家到失智據點的直線路徑)
        function drawCompleteExpectedPath(homeCoords, destinationCoords) {
            // 清除舊的預期路徑
            if (window.expectedPathLine) {
                map.removeLayer(window.expectedPathLine);
            }

            // 畫出從家到失智據點的直線路徑 (這是理想路線)
            window.expectedPathLine = L.polyline([homeCoords, destinationCoords], {
                color: '#10b981',
                weight: 4,
                opacity: 0.7,
                dashArray: '15, 10'
            }).addTo(map);
            window.expectedPathLine.bindPopup('📍 理想路線：從家直達失智據點');
        }

        // 🛣️ 畫出計劃路徑 (患者實際將要走的路線)
        function drawPlannedPath(pathSegment) {
            // 清除舊的計劃路徑
            if (window.plannedPathLine) {
                map.removeLayer(window.plannedPathLine);
            }

            // 畫出患者計劃要走的路線 (第一階段正常移動路徑)
            window.plannedPathLine = L.polyline(pathSegment, {
                color: '#3b82f6',
                weight: 3,
                opacity: 0.6,
                dashArray: '8, 5'
            }).addTo(map);
            window.plannedPathLine.bindPopup('🚶‍♀️ 計劃路線：患者實際行走路徑');
        }

        // 顯示徘徊警告
        function showWanderingAlert(currentPos) {
            // 這個函數在後面已經有實現，只需要確保它存在
            console.log('顯示徘徊警告於位置:', currentPos);
        }

        // 更新患者標記
        function updatePatientMarker(currentPos, status) {
            // 移除舊標記
            if (window.currentPatientMarker) {
                map.removeLayer(window.currentPatientMarker);
            }

            // 根據狀態設置樣式
            let markerClass = 'patient-marker';
            let bgColor = '#3b82f6';
            let borderColor = 'white';
            let animation = '';

            if (status === 'warning') {
                bgColor = '#f97316';
                markerClass += ' warning';
            } else if (status === 'alert') {
                bgColor = '#ef4444';
                markerClass += ' alert';
                animation = 'animation: pulse 1s infinite;';
            }

            // 創建新標記
            window.currentPatientMarker = L.marker(currentPos, {
                icon: L.divIcon({
                    className: markerClass,
                    html: \`<div style="width: 20px; height: 20px; background-color: \${bgColor}; border-radius: 50%; border: 3px solid \${borderColor}; box-shadow: 0 0 15px rgba(\${bgColor.slice(1)}, 0.8); \${animation}"></div>\`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(map);

            // 添加彈窗資訊
            const statusText = status === 'alert' ? '警報' : status === 'warning' ? '警告' : '正常';
            const statusColor = status === 'alert' ? '#ef4444' : status === 'warning' ? '#f97316' : '#10b981';
            window.currentPatientMarker.bindPopup(\`
                <div style="font-family: sans-serif;">
                    <strong>患者：陳秀英</strong><br>
                    <small>時間: \${new Date().toLocaleTimeString('zh-TW')}</small><br>
                    <span style="color: \${statusColor}; font-weight: bold;">狀態: \${statusText}</span>
                </div>
            \`);
        }

        // 更新實際行走路徑
        function updateActualPath() {
            if (window.actualPathLine) {
                map.removeLayer(window.actualPathLine);
            }

            const pathCoords = movementHistory.map(pos => [pos.lat, pos.lng]);

            // 根據最新狀態設置路徑顏色
            const latestStatus = movementHistory[movementHistory.length - 1].status;
            let pathColor = '#3b82f6'; // 正常：藍色

            if (latestStatus === 'warning') {
                pathColor = '#f97316'; // 警告：橙色
            } else if (latestStatus === 'alert') {
                pathColor = '#ef4444'; // 警報：紅色
            }

            window.actualPathLine = L.polyline(pathCoords, {
                color: pathColor,
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            window.actualPathLine.bindPopup('實際移動路徑');
        }

        // 更新路徑樣式
        function updatePathStyle(status) {
            if (!window.actualPathLine) return;

            let color = '#3b82f6';
            if (status === 'warning') {
                color = '#f97316';
            } else if (status === 'alert') {
                color = '#ef4444';
            }

            window.actualPathLine.setStyle({
                color: color,
                weight: 5,
                opacity: 0.9
            });
        }

        // 顯示系統警報
        function showSystemAlert(currentPos) {
            // 移除舊警報
            if (window.alertMarker) {
                map.removeLayer(window.alertMarker);
            }

            // 創建警報標記
            window.alertMarker = L.marker(currentPos, {
                icon: L.divIcon({
                    className: 'alert-marker',
                    html: \`
                        <div style="position: relative;">
                            <div style="width: 40px; height: 40px; background-color: #ef4444; border-radius: 50%; border: 3px solid white;
                                        display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;
                                        animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;">
                                ⚠️
                            </div>
                        </div>
                    \`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                })
            }).addTo(map);

            // 顯示警報彈窗
            window.alertMarker.bindPopup(\`
                <div style="font-family: sans-serif; text-align: center;">
                    <div style="color: #ef4444; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                        🚨 系統警報
                    </div>
                    <p style="margin: 5px 0;">偵測到異常行走模式！</p>
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">
                        患者在同一區域徘徊超過預設時間
                    </p>
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">
                        時間: \${new Date().toLocaleTimeString('zh-TW')}
                    </p>
                </div>
            \`).openPopup();

            // 地圖飛至警報位置
            map.flyTo(currentPos, 17, { duration: 1 });
        }

        // 颱風路徑式機率預測
        function updateTyphoonStylePrediction(currentPos, normalPath, currentStep) {
            // 清除舊預測
            clearPredictionPaths();

            if (currentStep >= normalPath.length - 1) return;

            // 生成多條預測路徑，類似颱風路徑預測
            const predictions = generateTyphoonStylePaths(currentPos, normalPath, currentStep);

            predictions.forEach((prediction, index) => {
                const pathPoints = prediction.path;
                const probability = prediction.probability;

                // 根據機率設定顏色和樣式
                let color, opacity, weight, dashArray;
                if (probability > 0.7) {
                    color = '#22c55e'; // 高機率：綠色
                    opacity = 0.8;
                    weight = 8;
                    dashArray = null;
                } else if (probability > 0.4) {
                    color = '#eab308'; // 中機率：黃色
                    opacity = 0.6;
                    weight = 6;
                    dashArray = null;
                } else {
                    color = '#f97316'; // 低機率：橙色
                    opacity = 0.4;
                    weight = 4;
                    dashArray = '5, 5';
                }

                // 創建預測路徑
                const pathLayer = L.polyline(pathPoints, {
                    color: color,
                    weight: weight,
                    opacity: opacity,
                    dashArray: dashArray,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(map);

                // 在路徑終點添加機率標籤
                if (pathPoints.length > 0) {
                    const endPoint = pathPoints[pathPoints.length - 1];
                    const probabilityPercent = Math.round(probability * 100);
                    const labelMarker = L.marker(endPoint, {
                        icon: L.divIcon({
                            className: 'probability-label',
                            html: probabilityPercent + '%',
                            iconSize: [40, 20],
                            iconAnchor: [20, 10]
                        })
                    }).addTo(map);

                    predictionPaths.push({
                        layer: pathLayer,
                        label: labelMarker,
                        probability: probability
                    });
                } else {
                    predictionPaths.push({
                        layer: pathLayer,
                        probability: probability
                    });
                }
            });
        }

        // 生成颱風路徑式預測路徑
        function generateTyphoonStylePaths(currentPos, normalPath, currentStep) {
            const predictions = [];
            const remainingPath = normalPath.slice(currentStep);

            if (remainingPath.length === 0) return predictions;

            // 主要路徑（最高機率）
            const mainPath = [currentPos, ...remainingPath];
            predictions.push({
                path: mainPath,
                probability: 0.85
            });

            // 生成偏移路徑
            const pathVariations = [
                { offset: 0.0005, probability: 0.65 },  // 輕微偏移
                { offset: 0.001, probability: 0.45 },   // 中度偏移
                { offset: 0.0015, probability: 0.25 },  // 大幅偏移
                { offset: 0.002, probability: 0.15 }    // 極端偏移
            ];

            pathVariations.forEach((variation, index) => {
                const offsetPath = [currentPos];

                for (let i = 1; i < remainingPath.length; i++) {
                    const point = remainingPath[i];
                    const randomOffset = (Math.random() - 0.5) * variation.offset * 2;
                    const offsetPoint = [
                        point[0] + randomOffset,
                        point[1] + randomOffset
                    ];
                    offsetPath.push(offsetPoint);
                }

                predictions.push({
                    path: offsetPath,
                    probability: variation.probability
                });
            });

            return predictions.sort((a, b) => b.probability - a.probability);
        }

        // 機率預測功能
        function toggleHeatmap() {
            showingHeatmap = !showingHeatmap;

            if (showingHeatmap) {
                updatePredictionPath();
                document.getElementById('heatmapStatus').textContent = '機率預測: 開啟';
            } else {
                clearPredictionPaths();
                document.getElementById('heatmapStatus').textContent = '機率預測: 關閉';
            }
        }

        // 清除機率預測路徑
        function clearPredictionPaths() {
            predictionPaths.forEach(prediction => {
                if (prediction.layer) {
                    map.removeLayer(prediction.layer);
                }
                if (prediction.label) {
                    map.removeLayer(prediction.label);
                }
            });
            predictionPaths = [];
        }

        // 更新機率預測路徑（類似颱風路徑圖）
        function updatePredictionPath() {
            if (!currentPatientLocation) return;

            // 清除舊的預測路徑
            clearPredictionPaths();

            // 生成多條可能的路徑，類似颱風路徑預測
            const predictions = generatePredictionPaths(currentPatientLocation, movementHistory);

            predictions.forEach((prediction, index) => {
                const pathPoints = prediction.path;
                const probability = prediction.probability;

                // 根據機率設定顏色和透明度
                let color, opacity, weight;
                if (probability > 0.7) {
                    color = '#00ff00'; // 高機率：綠色
                    opacity = 0.8;
                    weight = 6;
                } else if (probability > 0.4) {
                    color = '#ffff00'; // 中機率：黃色
                    opacity = 0.6;
                    weight = 4;
                } else {
                    color = '#ff6600'; // 低機率：橙色
                    opacity = 0.4;
                    weight = 2;
                }

                // 創建路徑線
                const pathLayer = L.polyline(pathPoints, {
                    color: color,
                    weight: weight,
                    opacity: opacity,
                    dashArray: probability < 0.5 ? '5, 5' : null
                }).addTo(map);

                // 在路徑終點添加機率標籤
                if (pathPoints.length > 0) {
                    const endPoint = pathPoints[pathPoints.length - 1];
                    const probabilityPercent = Math.round(probability * 100);
                    const labelMarker = L.marker(endPoint, {
                        icon: L.divIcon({
                            className: 'probability-label',
                            html: probabilityPercent + '%',
                            iconSize: [40, 20],
                            iconAnchor: [20, 10]
                        })
                    }).addTo(map);

                    predictionPaths.push({
                        layer: pathLayer,
                        label: labelMarker,
                        probability: probability
                    });
                } else {
                    predictionPaths.push({
                        layer: pathLayer,
                        probability: probability
                    });
                }
            });
        }

        // 生成預測路徑（模擬颱風路徑預測演算法）
        function generatePredictionPaths(currentLocation, history) {
            const predictions = [];
            const baseDistance = 0.002; // 基礎移動距離

            // 分析移動趨勢
            let direction = 0;
            let speed = baseDistance;

            if (history.length >= 2) {
                const lastMove = history[history.length - 1];
                const prevMove = history[history.length - 2];
                direction = Math.atan2(
                    lastMove.lat - prevMove.lat,
                    lastMove.lng - prevMove.lng
                );
                const distance = Math.sqrt(
                    Math.pow(lastMove.lat - prevMove.lat, 2) +
                    Math.pow(lastMove.lng - prevMove.lng, 2)
                );
                speed = Math.max(baseDistance * 0.5, Math.min(baseDistance * 2, distance));
            }

            // 生成多條預測路徑
            const pathCount = 5;
            for (let i = 0; i < pathCount; i++) {
                const pathPoints = [currentLocation.lat, currentLocation.lng];
                const steps = 6; // 預測6步
                let currentLat = currentLocation.lat;
                let currentLng = currentLocation.lng;
                let currentDirection = direction + (Math.random() - 0.5) * Math.PI / 2;
                let currentSpeed = speed * (0.5 + Math.random());

                const pathCoords = [[currentLat, currentLng]];

                for (let step = 0; step < steps; step++) {
                    // 添加隨機性和趨勢變化
                    currentDirection += (Math.random() - 0.5) * 0.3;
                    currentSpeed *= (0.8 + Math.random() * 0.4);

                    currentLat += Math.sin(currentDirection) * currentSpeed;
                    currentLng += Math.cos(currentDirection) * currentSpeed;

                    pathCoords.push([currentLat, currentLng]);
                }

                // 計算路徑機率（基於歷史行為和移動模式）
                let probability;
                if (i === 0) {
                    probability = 0.8; // 主要路徑
                } else if (i === 1) {
                    probability = 0.6; // 次要路徑
                } else {
                    probability = 0.3 - (i - 2) * 0.1; // 其他可能路徑
                }

                predictions.push({
                    path: pathCoords,
                    probability: Math.max(0.1, probability)
                });
            }

            return predictions.sort((a, b) => b.probability - a.probability);
        }

        // 路徑預測算法
        function calculateMovementProbability(locations) {
            if (locations.length < 2) return [];

            const predictions = [];
            const timePattern = analyzeTimePatterns(locations);
            const locationPattern = analyzeLocationPatterns(locations);

            // 基於歷史數據預測下一個可能的位置
            const lastLocation = locations[locations.length - 1];
            const probableNextLocations = [
                {
                    lat: lastLocation.latitude + (Math.random() - 0.5) * 0.001,
                    lng: lastLocation.longitude + (Math.random() - 0.5) * 0.001,
                    probability: 0.7
                },
                {
                    lat: lastLocation.latitude + (Math.random() - 0.5) * 0.002,
                    lng: lastLocation.longitude + (Math.random() - 0.5) * 0.002,
                    probability: 0.5
                },
                {
                    lat: lastLocation.latitude + (Math.random() - 0.5) * 0.003,
                    lng: lastLocation.longitude + (Math.random() - 0.5) * 0.003,
                    probability: 0.3
                }
            ];

            return probableNextLocations;
        }

        function analyzeTimePatterns(locations) {
            // 分析時間模式
            const hourlyActivity = new Array(24).fill(0);
            locations.forEach(loc => {
                const hour = new Date(loc.timestamp).getHours();
                hourlyActivity[hour]++;
            });
            return hourlyActivity;
        }

        function analyzeLocationPatterns(locations) {
            // 分析位置模式
            const locationFrequency = {};
            locations.forEach(loc => {
                const key = \`\${loc.latitude.toFixed(4)},\${loc.longitude.toFixed(4)}\`;
                locationFrequency[key] = (locationFrequency[key] || 0) + 1;
            });
            return locationFrequency;
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
                    // 更新預測和熱像圖數據
                    if (data.locations && data.locations.length > 0) {
                        const predictions = calculateMovementProbability(data.locations);
                        // 可以在這裡處理預測結果
                    }
                    break;
                case 'UPDATE_GEOFENCES':
                    updateGeofences(data.geofences);
                    break;
                case 'RECENTER':
                    recenterMap();
                    break;
                case 'START_SIMULATION':
                    startSimulation();
                    break;
                case 'STOP_SIMULATION':
                    stopSimulation();
                    break;
                case 'TOGGLE_HEATMAP':
                    toggleHeatmap();
                    break;
                case 'UPDATE_SIMULATION_MODE':
                    // 處理模擬模式切換
                    if (data.enabled && !isSimulating) {
                        document.getElementById('simStatus').textContent = '準備就緒';
                    }
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

  const startSimulation = () => {
    sendToWebView('START_SIMULATION');
    onSimulationStart?.();
  };

  const stopSimulation = () => {
    sendToWebView('STOP_SIMULATION');
    onSimulationStop?.();
  };

  const toggleHeatmap = () => {
    sendToWebView('TOGGLE_HEATMAP');
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
        case 'SIMULATION_STARTED':
          console.log('Simulation started');
          break;
        case 'SIMULATION_STOPPED':
          console.log('Simulation stopped');
          break;
        case 'SIMULATION_UPDATE':
          console.log('Simulation update:', message.data);
          onLocationUpdate?.(message.data.location);
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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default LeafletMap;