const db = require('./services/database');

async function checkUsers() {
  try {
    // 檢查所有用戶
    const allUsers = await db.query('SELECT id, email, name, role FROM users ORDER BY created_at');

    console.log('📋 所有用戶列表：');
    if (allUsers.rows.length === 0) {
      console.log('❌ 沒有找到任何用戶');
    } else {
      allUsers.rows.forEach((user, i) => {
        console.log(`${i+1}. ${user.email} - ${user.name} (${user.role}) [ID: ${user.id}]`);
      });
    }

    // 檢查特定的測試帳號
    const testEmails = ['test@example.com', 'test@hsinchu.gov.tw'];

    console.log('\n🔍 測試帳號檢查：');
    for (const email of testEmails) {
      const user = await db.getUserByEmail(email);
      if (user) {
        console.log(`✅ ${email} - 存在 (ID: ${user.id})`);

        // 檢查該用戶的患者
        const patients = await db.getPatientsByGuardianId(user.id);
        console.log(`   患者數量: ${patients.length}`);
        patients.forEach((patient, i) => {
          console.log(`   ${i+1}. ${patient.name} (ID: ${patient.id})`);
        });
      } else {
        console.log(`❌ ${email} - 不存在`);
      }
    }

  } catch (error) {
    console.error('❌ 檢查用戶失敗:', error);
  } finally {
    await db.close();
  }
}

checkUsers();