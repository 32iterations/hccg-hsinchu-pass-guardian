// 管理儀表板主要應用程式
const API_BASE = window.location.protocol + '//' + window.location.hostname + ':3001';
let authToken = localStorage.getItem('adminToken');
let map = null;
let markers = {};
let socket = null;
let patients = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeEventListeners();
});

// 檢查認證狀態
function checkAuth() {
    if (!authToken) {
        showLoginModal();
    } else {
        hideLoginModal();
        initializeDashboard();
    }
}

// 顯示/隱藏登入模態框
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// 初始化事件監聽器
function initializeEventListeners() {
    // 登入表單
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                authToken = data.token;
                localStorage.setItem('adminToken', authToken);
                hideLoginModal();
                initializeDashboard();
                addLog('info', '管理員登入成功');
            } else {
                alert('登入失敗：' + data.error);
            }
        } catch (error) {
            console.error('登入錯誤:', error);
            alert('登入失敗，請稍後再試');
        }
    });

    // 登出按鈕
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('確定要登出嗎？')) {
            localStorage.removeItem('adminToken');
            authToken = null;
            if (socket) {
                socket.disconnect();
            }
            showLoginModal();
            addLog('info', '管理員登出');
        }
    });
}

// 初始化儀表板
async function initializeDashboard() {
    initializeMap();
    await loadPatients();
    initializeWebSocket();
    updateLastUpdateTime();

    // 每30秒更新一次數據
    setInterval(async () => {
        await loadPatients();
        updateLastUpdateTime();
    }, 30000);
}

// 初始化地圖
function initializeMap() {
    // 設定新竹市中心座標
    const hsinchu = [24.8138, 120.9675];

    map = L.map('map').setView(hsinchu, 13);

    // 使用 OpenStreetMap 圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    addLog('info', '地圖初始化完成');
}

// 載入患者資料
async function loadPatients() {
    try {
        const response = await fetch(`${API_BASE}/api/patients`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            patients = data.patients || [];
            updatePatientsDisplay();
            updateStatistics();
        }
    } catch (error) {
        console.error('載入患者失敗:', error);
        addLog('error', '載入患者資料失敗');
    }
}

// 更新患者顯示
function updatePatientsDisplay() {
    const patientsList = document.getElementById('patientsList');
    patientsList.innerHTML = '';

    if (patients.length === 0) {
        patientsList.innerHTML = '<p class="text-gray-500 text-center py-4">尚無患者資料</p>';
        return;
    }

    patients.forEach(patient => {
        const isOnline = patient.last_seen &&
            (new Date() - new Date(patient.last_seen)) < 300000; // 5分鐘內視為在線

        const patientCard = document.createElement('div');
        patientCard.className = 'patient-card bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100';
        patientCard.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <h3 class="font-semibold">${patient.name}</h3>
                    <p class="text-sm text-gray-600">年齡: ${patient.age}歲</p>
                    <p class="text-sm text-gray-600">Beacon: ${patient.beacon_id || '未配置'}</p>
                </div>
                <div class="flex items-center">
                    <span class="w-2 h-2 ${isOnline ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-2"></span>
                    <span class="text-sm ${isOnline ? 'text-green-600' : 'text-gray-500'}">
                        ${isOnline ? '在線' : '離線'}
                    </span>
                </div>
            </div>
        `;

        patientCard.addEventListener('click', () => {
            showPatientDetails(patient);
        });

        patientsList.appendChild(patientCard);

        // 如果有位置資訊，在地圖上添加標記
        if (patient.last_location) {
            addPatientMarker(patient);
        }
    });
}

// 在地圖上添加患者標記
function addPatientMarker(patient) {
    const { latitude, longitude } = patient.last_location;

    // 移除舊標記
    if (markers[patient.id]) {
        map.removeLayer(markers[patient.id]);
    }

    // 創建自定義圖標
    const icon = L.divIcon({
        className: 'patient-marker',
        html: `<div>${patient.name.charAt(0)}</div>`,
        iconSize: [30, 30]
    });

    // 添加新標記
    const marker = L.marker([latitude, longitude], { icon })
        .addTo(map)
        .bindPopup(`
            <strong>${patient.name}</strong><br>
            年齡: ${patient.age}歲<br>
            最後更新: ${new Date(patient.last_location.timestamp).toLocaleString('zh-TW')}
        `);

    markers[patient.id] = marker;
}

// 顯示患者詳細資訊
async function showPatientDetails(patient) {
    try {
        const response = await fetch(`${API_BASE}/api/locations/${patient.id}/history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const locations = data.locations || [];

            // 如果有位置歷史，繪製路徑
            if (locations.length > 0) {
                drawPatientPath(locations);

                // 聚焦到最新位置
                const latest = locations[0];
                map.setView([latest.latitude, latest.longitude], 16);
            }

            addLog('info', `查看患者 ${patient.name} 的詳細資訊`);
        }
    } catch (error) {
        console.error('載入位置歷史失敗:', error);
    }
}

// 繪製患者移動路徑
function drawPatientPath(locations) {
    const coordinates = locations.map(loc => [loc.latitude, loc.longitude]);

    // 繪製路徑線
    L.polyline(coordinates, {
        color: 'blue',
        weight: 3,
        opacity: 0.7,
        smoothFactor: 1
    }).addTo(map);
}

// 初始化 WebSocket 連接
function initializeWebSocket() {
    // 注意：這需要後端支援 WebSocket
    // 暫時使用輪詢替代
    setInterval(async () => {
        await checkForUpdates();
    }, 5000); // 每5秒檢查更新

    updateConnectionStatus(true);
    addLog('info', '即時監控已啟動');
}

// 檢查更新
async function checkForUpdates() {
    // 這裡可以實作檢查新位置更新的邏輯
    await loadPatients();
}

// 更新統計資訊
function updateStatistics() {
    document.getElementById('totalPatients').textContent = patients.length;

    const onlineCount = patients.filter(p =>
        p.last_seen && (new Date() - new Date(p.last_seen)) < 300000
    ).length;
    document.getElementById('onlineDevices').textContent = onlineCount;

    // 這裡可以根據實際情況計算警報數
    document.getElementById('activeAlerts').textContent = '0';
}

// 更新最後更新時間
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent =
        now.toLocaleTimeString('zh-TW');
}

// 更新連接狀態
function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    if (isConnected) {
        statusElement.innerHTML = `
            <span class="w-2 h-2 bg-green-500 rounded-full mr-2 online-indicator"></span>
            <span>連線中</span>
        `;
    } else {
        statusElement.innerHTML = `
            <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            <span>離線</span>
        `;
    }
}

// 添加系統日誌
function addLog(type, message) {
    const logsContainer = document.getElementById('systemLogs');
    const logRow = document.createElement('tr');

    const typeClass = {
        'info': 'text-blue-600',
        'warning': 'text-yellow-600',
        'error': 'text-red-600',
        'success': 'text-green-600'
    }[type] || 'text-gray-600';

    logRow.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${new Date().toLocaleString('zh-TW')}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm ${typeClass}">
            ${type.toUpperCase()}
        </td>
        <td class="px-6 py-4 text-sm text-gray-900">
            ${message}
        </td>
    `;

    // 插入到最前面
    logsContainer.insertBefore(logRow, logsContainer.firstChild);

    // 只保留最新的20條日誌
    while (logsContainer.children.length > 20) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}