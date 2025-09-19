const db = require('./services/database');

async function addDemoDataForTestExample() {
  try {
    console.log('🚨 為 test@example.com 新增demo資料...');

    // 獲取 test@example.com 用戶
    const user = await db.getUserByEmail('test@example.com');
    if (!user) {
      console.error('❌ test@example.com 用戶不存在');
      return;
    }

    console.log(`✅ 找到用戶: ${user.email} (ID: ${user.id})`);

    // 獲取該用戶的患者
    const patients = await db.getPatientsByGuardianId(user.id);
    console.log(`患者列表: ${patients.length}位`);
    patients.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));

    if (patients.length === 0) {
      console.log('❌ 該用戶沒有患者，無法添加demo資料');
      return;
    }

    // 為該用戶的患者添加地理圍欄
    const hsinchuLocations = [
      { name: '新竹科學園區', lat: 24.7964, lng: 120.9975, radius: 200 },
      { name: '新竹動物園', lat: 24.8021, lng: 120.9741, radius: 150 },
      { name: '新竹城隍廟', lat: 24.8034, lng: 120.9688, radius: 100 }
    ];

    console.log('\n📍 新增地理圍欄...');
    for (const patient of patients) {
      // 為每個患者添加家和2個公共場所
      const patientHome = {
        name: `${patient.name}的家`,
        lat: 24.8000 + Math.random() * 0.02, // 隨機座標
        lng: 120.9700 + Math.random() * 0.02,
        radius: 100
      };

      const geofences = [patientHome, ...hsinchuLocations.slice(0, 2)];

      for (const location of geofences) {
        await db.query(
          `INSERT INTO geofences (patient_id, name, center_lat, center_lng, radius, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW())`,
          [patient.id, location.name, location.lat, location.lng, location.radius]
        );
        console.log(`  ✅ ${patient.name}: ${location.name}`);
      }
    }

    // 添加警報記錄
    console.log('\n🚨 新增警報記錄...');
    const alertTypes = [
      { type: 'fall_detection', message: '偵測到跌倒事件', severity: 'critical' },
      { type: 'heart_rate_abnormal', message: '心率異常', severity: 'high' },
      { type: 'safe_arrival', message: '安全抵達目的地', severity: 'info' },
      { type: 'medication_reminder', message: '服藥提醒', severity: 'low' },
      { type: 'low_battery', message: '電量不足', severity: 'medium' }
    ];

    for (const patient of patients) {
      // 每個患者添加5-8筆警報
      const numAlerts = 5 + Math.floor(Math.random() * 4);

      for (let i = 0; i < numAlerts; i++) {
        const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const hoursAgo = Math.floor(Math.random() * 168); // 過去一週
        const alertTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
        const isResolved = Math.random() < 0.6; // 60%已解決

        await db.query(
          `INSERT INTO alerts (patient_id, type, message, location, is_resolved, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            patient.id,
            alertType.type,
            `${alertType.message} - ${patient.name}`,
            JSON.stringify({
              latitude: 24.8000 + Math.random() * 0.02,
              longitude: 120.9700 + Math.random() * 0.02,
              accuracy: 5 + Math.random() * 15
            }),
            isResolved,
            alertTime
          ]
        );
      }
      console.log(`  ✅ ${patient.name}: ${numAlerts}筆警報記錄`);
    }

    // 添加位置歷史
    console.log('\n📍 新增位置歷史...');
    for (const patient of patients) {
      const numLocations = 3 + Math.floor(Math.random() * 3);

      for (let i = 0; i < numLocations; i++) {
        const hoursAgo = Math.floor(Math.random() * 24); // 過去一天
        const locationTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        await db.query(
          `INSERT INTO locations (patient_id, latitude, longitude, accuracy, timestamp, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            patient.id,
            24.8000 + Math.random() * 0.02,
            120.9700 + Math.random() * 0.02,
            5 + Math.random() * 15,
            locationTime,
            locationTime
          ]
        );
      }
      console.log(`  ✅ ${patient.name}: ${numLocations}筆位置記錄`);
    }

    console.log('\n🎉 demo資料新增完成！');

    // 統計結果
    const alertCount = await db.query(
      'SELECT COUNT(*) as total FROM alerts a JOIN patients p ON a.patient_id = p.id WHERE p.guardian_id = $1',
      [user.id]
    );

    const geofenceCount = await db.query(
      'SELECT COUNT(*) as total FROM geofences g JOIN patients p ON g.patient_id = p.id WHERE p.guardian_id = $1',
      [user.id]
    );

    console.log(`📊 統計結果:`);
    console.log(`   患者數: ${patients.length}`);
    console.log(`   警報記錄: ${alertCount.rows[0].total}筆`);
    console.log(`   地理圍欄: ${geofenceCount.rows[0].total}個`);

  } catch (error) {
    console.error('❌ 添加demo資料失敗:', error);
  } finally {
    await db.close();
  }
}

addDemoDataForTestExample();