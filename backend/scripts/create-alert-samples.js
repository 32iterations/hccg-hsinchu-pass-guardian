// 創建警報記錄範例資料
const axios = require('axios');

const API_BASE = 'http://localhost:3001';

// 警報範例資料
const alertSamples = [
  {
    patientId: 1,
    patientName: '王大明',
    type: 'geofence_exit',
    severity: 'high',
    message: '患者已離開安全區域 - 新竹市東區中央路',
    location: {
      latitude: 24.8050,
      longitude: 120.9689,
      address: '新竹市東區中央路100號附近'
    },
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5分鐘前
  },
  {
    patientId: 2,
    patientName: '李小美',
    type: 'no_movement',
    severity: 'medium',
    message: '患者超過30分鐘未移動',
    location: {
      latitude: 24.8047,
      longitude: 120.9688,
      address: '新竹市東區公園路50號'
    },
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15分鐘前
  },
  {
    patientId: 3,
    patientName: '張志強',
    type: 'emergency_sos',
    severity: 'critical',
    message: '緊急求救！患者按下SOS按鈕',
    location: {
      latitude: 24.8095,
      longitude: 120.9729,
      address: '新竹市北區中山路200號'
    },
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30分鐘前
  },
  {
    patientId: 1,
    patientName: '王大明',
    type: 'battery_low',
    severity: 'low',
    message: '設備電量低於20%',
    location: {
      latitude: 24.8066,
      longitude: 120.9707,
      address: '新竹市東區光復路一段89號'
    },
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString() // 45分鐘前
  },
  {
    patientId: 4,
    patientName: '陳秀英',
    type: 'geofence_enter',
    severity: 'info',
    message: '患者已進入安全區域 - 新竹市立醫院',
    location: {
      latitude: 24.8072,
      longitude: 120.9724,
      address: '新竹市東區經國路一段442號'
    },
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1小時前
  },
  {
    patientId: 5,
    patientName: '林建國',
    type: 'rapid_movement',
    severity: 'medium',
    message: '偵測到異常快速移動（可能搭乘交通工具）',
    location: {
      latitude: 24.8013,
      longitude: 120.9718,
      address: '新竹市東區光復路二段295號'
    },
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString() // 1.5小時前
  },
  {
    patientId: 2,
    patientName: '李小美',
    type: 'night_activity',
    severity: 'medium',
    message: '深夜異常活動警報（凌晨2:30）',
    location: {
      latitude: 24.8055,
      longitude: 120.9698,
      address: '新竹市東區民生路168號'
    },
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString() // 2小時前
  },
  {
    patientId: 6,
    patientName: '黃美華',
    type: 'beacon_lost',
    severity: 'high',
    message: '藍牙Beacon訊號遺失超過10分鐘',
    location: {
      latitude: 24.8043,
      longitude: 120.9676,
      address: '新竹市東區南大路520號'
    },
    timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString() // 2.5小時前
  },
  {
    patientId: 3,
    patientName: '張志強',
    type: 'fall_detected',
    severity: 'critical',
    message: '偵測到可能跌倒事件',
    location: {
      latitude: 24.8089,
      longitude: 120.9735,
      address: '新竹市北區中正路120號'
    },
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString() // 3小時前
  },
  {
    patientId: 7,
    patientName: '劉文彬',
    type: 'geofence_warning',
    severity: 'medium',
    message: '患者接近地理圍欄邊界（距離50公尺）',
    location: {
      latitude: 24.8033,
      longitude: 120.9666,
      address: '新竹市東區建功一路68號'
    },
    timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString() // 3.5小時前
  },
  {
    patientId: 8,
    patientName: '吳淑芬',
    type: 'schedule_missed',
    severity: 'low',
    message: '患者未按預定時間返回（預定下午5:00）',
    location: {
      latitude: 24.8078,
      longitude: 120.9741,
      address: '新竹市北區西大路323號'
    },
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString() // 4小時前
  },
  {
    patientId: 4,
    patientName: '陳秀英',
    type: 'medication_reminder',
    severity: 'info',
    message: '用藥提醒 - 請協助患者服藥',
    location: {
      latitude: 24.8061,
      longitude: 120.9712,
      address: '新竹市東區金山街85號'
    },
    timestamp: new Date(Date.now() - 300 * 60 * 1000).toISOString() // 5小時前
  }
];

// 登入並創建警報記錄
async function createAlertSamples() {
  try {
    console.log('📝 開始創建警報記錄範例...\n');

    // 首先登入取得 token
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: 'admin@hsinchu.gov.tw',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ 登入成功，取得管理員權限\n');

    // 創建每個警報記錄
    for (const alert of alertSamples) {
      try {
        const response = await axios.post(
          `${API_BASE}/api/alerts`,
          alert,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const severityIcon = {
          'critical': '🔴',
          'high': '🟠',
          'medium': '🟡',
          'low': '🔵',
          'info': '⚪'
        }[alert.severity] || '⚪';

        console.log(`${severityIcon} 創建警報: ${alert.type} - ${alert.patientName}`);
        console.log(`  📍 位置: ${alert.location.address}`);
        console.log(`  💬 訊息: ${alert.message}\n`);
      } catch (error) {
        console.error(`❌ 創建警報失敗: ${alert.type}`, error.response?.data || error.message);
      }
    }

    console.log('✨ 警報記錄範例創建完成！');
    console.log(`📊 共創建 ${alertSamples.length} 筆警報記錄`);
    console.log('\n您現在可以在管理介面查看這些警報記錄了！');

  } catch (error) {
    console.error('❌ 錯誤:', error.response?.data || error.message);
  }
}

// 執行創建
createAlertSamples();