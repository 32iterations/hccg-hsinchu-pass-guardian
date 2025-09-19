const axios = require('axios');

const API_BASE = 'http://localhost:3001';

// 為兩個帳號創建警報記錄
async function createAlertsForBothUsers() {
  try {
    console.log('📝 開始為兩個帳號創建警報記錄...\n');

    // 第一個帳號的警報 (test@example.com)
    const user1Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaXNBZG1pbiI6ZmFsc2UsImlhdCI6MTc1ODI3MjEyMiwiZXhwIjoxNzU4ODc2OTIyfQ.UYx8IsujQt1_QwXR4gwNGQElrX-JRibTOaj8nS_OhcU';
    const user1Alerts = [
      {
        patientId: 1,
        patientName: '王大明',
        type: 'geofence_exit',
        severity: 'high',
        message: '患者已離開安全區域 - 東門市場附近',
        location: {
          latitude: 24.8033,
          longitude: 120.9666,
          address: '新竹市東區中央路100號附近'
        }
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
        }
      },
      {
        patientId: 3,
        patientName: '張志強',
        type: 'emergency_sos',
        severity: 'critical',
        message: '緊急求救！患者按下SOS按鈕',
        location: {
          latitude: 24.8061,
          longitude: 120.9658,
          address: '新竹都城隍廟附近'
        }
      },
      {
        patientId: 1,
        patientName: '王大明',
        type: 'battery_low',
        severity: 'low',
        message: '設備電量低於20%',
        location: {
          latitude: 24.8072,
          longitude: 120.9724,
          address: '新竹馬偕紀念醫院'
        }
      }
    ];

    // 第二個帳號的警報 (test@hsinchu.gov.tw)
    const user2Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0QGhzaW5jaHUuZ292LnR3IiwiaXNBZG1pbiI6ZmFsc2UsImlhdCI6MTc1ODI3MjE5MCwiZXhwIjoxNzU4ODc2OTkwfQ.BW1pJ_nC-yPDFG37hFTDS_Dsg5Urzv-3v_wHvX5Yn64';
    const user2Alerts = [
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
        }
      },
      {
        patientId: 5,
        patientName: '林建國',
        type: 'rapid_movement',
        severity: 'medium',
        message: '偵測到異常快速移動（可能搭乘交通工具）',
        location: {
          latitude: 24.8019,
          longitude: 120.9718,
          address: '新竹火車站'
        }
      },
      {
        patientId: 6,
        patientName: '黃美華',
        type: 'beacon_lost',
        severity: 'high',
        message: '藍牙Beacon訊號遺失超過10分鐘',
        location: {
          latitude: 24.8089,
          longitude: 120.9735,
          address: '巨城購物中心'
        }
      },
      {
        patientId: 4,
        patientName: '陳秀英',
        type: 'fall_detected',
        severity: 'critical',
        message: '偵測到可能跌倒事件',
        location: {
          latitude: 24.8055,
          longitude: 120.9698,
          address: '竹蓮寺附近'
        }
      },
      {
        patientId: 5,
        patientName: '林建國',
        type: 'geofence_warning',
        severity: 'medium',
        message: '患者接近地理圍欄邊界（距離50公尺）',
        location: {
          latitude: 24.7916,
          longitude: 120.9585,
          address: '青草湖邊界'
        }
      }
    ];

    // 創建第一個用戶的警報
    console.log('🔷 為 test@example.com 創建警報記錄：');
    for (const alert of user1Alerts) {
      try {
        await axios.post(
          `${API_BASE}/api/alerts`,
          alert,
          {
            headers: {
              'Authorization': `Bearer ${user1Token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const icon = {
          'critical': '🔴',
          'high': '🟠',
          'medium': '🟡',
          'low': '🔵',
          'info': '⚪'
        }[alert.severity];
        console.log(`  ${icon} ${alert.patientName} - ${alert.type}`);
      } catch (error) {
        console.error(`  ❌ 創建警報失敗:`, error.response?.data || error.message);
      }
    }

    // 創建第二個用戶的警報
    console.log('\n🔷 為 test@hsinchu.gov.tw 創建警報記錄：');
    for (const alert of user2Alerts) {
      try {
        await axios.post(
          `${API_BASE}/api/alerts`,
          alert,
          {
            headers: {
              'Authorization': `Bearer ${user2Token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const icon = {
          'critical': '🔴',
          'high': '🟠',
          'medium': '🟡',
          'low': '🔵',
          'info': '⚪'
        }[alert.severity];
        console.log(`  ${icon} ${alert.patientName} - ${alert.type}`);
      } catch (error) {
        console.error(`  ❌ 創建警報失敗:`, error.response?.data || error.message);
      }
    }

    console.log('\n✨ 完成！兩個帳號都已有完整的測試資料：\n');
    console.log('📱 帳號1: test@example.com / test123');
    console.log('   - 3 位患者：王大明、李小美、張志強');
    console.log('   - 4 筆警報記錄');
    console.log('\n📱 帳號2: test@hsinchu.gov.tw / test123');
    console.log('   - 3 位患者：陳秀英、林建國、黃美華');
    console.log('   - 5 筆警報記錄');
    console.log('\n🗺️ 共用功能：');
    console.log('   - 10 個地理圍欄區域（新竹市重要地點）');
    console.log('   - 3 個位置模擬場景（長輩迷路模擬）');

  } catch (error) {
    console.error('❌ 錯誤:', error.response?.data || error.message);
  }
}

createAlertsForBothUsers();