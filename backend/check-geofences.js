const db = require('./services/database');

async function checkGeofences() {
  try {
    const user = await db.getUserByEmail('test@hsinchu.gov.tw');
    if (!user) {
      console.log('❌ 測試用戶不存在');
      return;
    }

    // 檢查地理圍欄數量
    const geofenceResult = await db.query(
      `SELECT COUNT(*) as total FROM geofences g
       JOIN patients p ON g.patient_id = p.id
       WHERE p.guardian_id = $1`,
      [user.id]
    );

    console.log('📍 地理圍欄統計：');
    console.log(`   總圍欄數: ${geofenceResult.rows[0].total}`);

    // 獲取地理圍欄詳細資料
    const geofences = await db.query(
      `SELECT g.*, p.name as patient_name
       FROM geofences g
       JOIN patients p ON g.patient_id = p.id
       WHERE p.guardian_id = $1
       ORDER BY g.created_at DESC`,
      [user.id]
    );

    console.log('\n📋 地理圍欄列表：');
    if (geofences.rows.length === 0) {
      console.log('❌ 沒有找到任何地理圍欄資料');
    } else {
      geofences.rows.forEach((fence, i) => {
        console.log(`${i+1}. ${fence.name} (${fence.patient_name})`);
        console.log(`   中心點: ${fence.center_lat}, ${fence.center_lng}`);
        console.log(`   半徑: ${fence.radius}米 | 狀態: ${fence.is_active ? '啟用' : '停用'}`);
      });
    }

    // 檢查位置歷史
    const locationResult = await db.query(
      `SELECT COUNT(*) as total FROM locations l
       JOIN patients p ON l.patient_id = p.id
       WHERE p.guardian_id = $1`,
      [user.id]
    );

    console.log(`\n📍 位置歷史統計：`);
    console.log(`   總位置記錄: ${locationResult.rows[0].total}`);

  } catch (error) {
    console.error('❌ 檢查地理圍欄失敗:', error);
  } finally {
    await db.close();
  }
}

checkGeofences();