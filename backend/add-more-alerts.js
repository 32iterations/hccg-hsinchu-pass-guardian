const db = require('./services/database');

async function addMoreAlerts() {
  try {
    console.log('🚨 新增更多警報記錄 demo 資料...');

    // 獲取測試用戶的患者 ID
    const user = await db.getUserByEmail('test@hsinchu.gov.tw');
    if (!user) {
      console.error('測試用戶不存在');
      return;
    }

    const patients = await db.getPatientsByGuardianId(user.id);
    console.log(`找到 ${patients.length} 位患者`);

    const now = new Date();
    const alertTypes = [
      {
        type: 'fall_detection',
        message: '偵測到跌倒事件，請立即查看',
        severity: 'critical'
      },
      {
        type: 'heart_rate_abnormal',
        message: '心率異常，建議就醫檢查',
        severity: 'high'
      },
      {
        type: 'irregular_movement',
        message: '活動模式異常，可能需要關注',
        severity: 'medium'
      },
      {
        type: 'safe_arrival',
        message: '患者已安全抵達目的地',
        severity: 'info'
      },
      {
        type: 'activity_reminder',
        message: '提醒患者進行日常活動',
        severity: 'low'
      },
      {
        type: 'weather_alert',
        message: '天氣變化提醒，注意保暖',
        severity: 'medium'
      },
      {
        type: 'emergency_contact',
        message: '緊急聯絡人已收到通知',
        severity: 'info'
      },
      {
        type: 'medication_taken',
        message: '患者已確認服藥完成',
        severity: 'info'
      },
      {
        type: 'zone_violation',
        message: '進入禁止區域，請確認安全',
        severity: 'high'
      },
      {
        type: 'device_tampered',
        message: '偵測到裝置被移除或破壞',
        severity: 'critical'
      }
    ];

    // 新竹市區域的座標範圍
    const hsinchuAreas = [
      { name: '新竹火車站', lat: 24.8018, lng: 120.9718 },
      { name: '新竹市政府', lat: 24.8138, lng: 120.9675 },
      { name: '巨城購物中心', lat: 24.8105, lng: 120.9747 },
      { name: '清華大學', lat: 24.7956, lng: 120.9966 },
      { name: '新竹馬偕醫院', lat: 24.8094, lng: 120.9906 },
      { name: '新竹公園', lat: 24.8025, lng: 120.9741 },
      { name: '護城河親水公園', lat: 24.8068, lng: 120.9718 },
      { name: '新竹東門市場', lat: 24.8062, lng: 120.9698 }
    ];

    let alertId = 22; // 從現有的最後一個 ID 開始

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];

      // 為每個患者添加 8-12 條不同類型的警報
      const numAlerts = 8 + Math.floor(Math.random() * 5);

      for (let j = 0; j < numAlerts; j++) {
        const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const area = hsinchuAreas[Math.floor(Math.random() * hsinchuAreas.length)];

        // 隨機時間（過去 7 天內）
        const hoursAgo = Math.floor(Math.random() * 168); // 7 天 = 168 小時
        const alertTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

        // 生成座標（在區域附近）
        const latitude = area.lat + (Math.random() - 0.5) * 0.01; // ±0.005 度變化
        const longitude = area.lng + (Math.random() - 0.5) * 0.01;
        const accuracy = 5 + Math.random() * 20; // 5-25 米精度

        // 決定是否已解決（70% 機率已解決）
        const isResolved = Math.random() < 0.7;

        const alertData = {
          patient_id: patient.id,
          type: alertType.type,
          message: `${alertType.message} - ${patient.name} (${area.name}附近)`,
          location: JSON.stringify({
            latitude,
            longitude,
            accuracy,
            area: area.name
          }),
          is_resolved: isResolved,
          created_at: alertTime
        };

        try {
          await db.query(
            `INSERT INTO alerts (patient_id, type, message, location, is_resolved, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              alertData.patient_id,
              alertData.type,
              alertData.message,
              alertData.location,
              alertData.is_resolved,
              alertData.created_at
            ]
          );

          console.log(`✅ 新增警報 ${alertId}: ${alertType.type} - ${patient.name}`);
          alertId++;
        } catch (error) {
          console.error(`❌ 新增警報失敗:`, error.message);
        }
      }
    }

    // 添加一些系統級警報
    const systemAlerts = [
      {
        type: 'system_maintenance',
        message: '系統維護通知：將於今晚進行例行維護',
        patient_id: patients[0].id
      },
      {
        type: 'app_update',
        message: '應用程式更新可用，建議立即更新',
        patient_id: patients[1].id
      },
      {
        type: 'server_status',
        message: '伺服器狀態正常，所有服務運行穩定',
        patient_id: patients[0].id
      }
    ];

    for (const sysAlert of systemAlerts) {
      const alertTime = new Date(now.getTime() - Math.floor(Math.random() * 24) * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO alerts (patient_id, type, message, location, is_resolved, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sysAlert.patient_id,
          sysAlert.type,
          sysAlert.message,
          JSON.stringify({ system: true }),
          true,
          alertTime
        ]
      );

      console.log(`✅ 新增系統警報: ${sysAlert.type}`);
    }

    console.log('\n🎉 警報記錄 demo 資料新增完成！');

    // 顯示統計
    const totalAlerts = await db.query(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN is_resolved THEN 1 ELSE 0 END) as resolved,
       SUM(CASE WHEN NOT is_resolved THEN 1 ELSE 0 END) as pending
       FROM alerts a
       JOIN patients p ON a.patient_id = p.id
       WHERE p.guardian_id = $1`,
      [user.id]
    );

    const stats = totalAlerts.rows[0];
    console.log(`📊 統計資訊：`);
    console.log(`   總警報數: ${stats.total}`);
    console.log(`   已解決: ${stats.resolved}`);
    console.log(`   待處理: ${stats.pending}`);

  } catch (error) {
    console.error('新增警報記錄時發生錯誤:', error);
  } finally {
    await db.close();
  }
}

addMoreAlerts();