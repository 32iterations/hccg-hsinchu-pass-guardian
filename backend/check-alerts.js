const db = require('./services/database');

async function checkAlerts() {
  try {
    const user = await db.getUserByEmail('test@hsinchu.gov.tw');
    if (!user) {
      console.log('❌ 測試用戶不存在');
      return;
    }

    const result = await db.query(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN is_resolved THEN 1 ELSE 0 END) as resolved,
       SUM(CASE WHEN NOT is_resolved THEN 1 ELSE 0 END) as pending
       FROM alerts a
       JOIN patients p ON a.patient_id = p.id
       WHERE p.guardian_id = $1`,
      [user.id]
    );

    const stats = result.rows[0];
    console.log('✅ 警報記錄統計：');
    console.log(`   總警報數: ${stats.total}`);
    console.log(`   已解決: ${stats.resolved}`);
    console.log(`   待處理: ${stats.pending}`);

    // 獲取最新的5筆警報記錄作為範例
    const alerts = await db.query(
      `SELECT a.*, p.name as patient_name
       FROM alerts a
       JOIN patients p ON a.patient_id = p.id
       WHERE p.guardian_id = $1
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [user.id]
    );

    console.log('\n📋 最新5筆警報記錄：');
    alerts.rows.forEach((alert, i) => {
      console.log(`${i+1}. [${alert.type}] ${alert.message}`);
      console.log(`   患者: ${alert.patient_name} | 時間: ${alert.created_at} | 狀態: ${alert.is_resolved ? '已解決' : '待處理'}`);
    });

  } catch (error) {
    console.error('❌ 檢查警報記錄失敗:', error);
  } finally {
    await db.close();
  }
}

checkAlerts();