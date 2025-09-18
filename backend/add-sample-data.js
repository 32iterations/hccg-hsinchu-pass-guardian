const bcrypt = require('bcryptjs');
const db = require('./services/database');

async function addSampleData() {
  try {
    console.log('Adding sample data for test@example.com...');
    
    // Get user ID
    const user = await db.getUserByEmail('test@example.com');
    if (!user) {
      console.error('User test@example.com not found!');
      return;
    }
    
    console.log('Found user:', user.id, user.name);
    
    // Add geofences
    const geofences = [
      {
        name: '新竹市政府',
        type: 'government',
        latitude: 24.8138,
        longitude: 120.9675,
        radius: 150,
        address: '新竹市北區中正路120號',
        description: '新竹市政府大樓'
      },
      {
        name: '新竹火車站',
        type: 'transit',
        latitude: 24.8018,
        longitude: 120.9718,
        radius: 200,
        address: '新竹市東區中華路二段445號',
        description: '主要交通樞紐'
      },
      {
        name: '巨城購物中心',
        type: 'shopping',
        latitude: 24.8105,
        longitude: 120.9747,
        radius: 300,
        address: '新竹市東區中央路229號',
        description: 'Big City 遠東巨城購物中心'
      },
      {
        name: '清華大學',
        type: 'education',
        latitude: 24.7956,
        longitude: 120.9966,
        radius: 500,
        address: '新竹市東區光復路二段101號',
        description: '國立清華大學校園'
      },
      {
        name: '新竹馬偕醫院',
        type: 'hospital',
        latitude: 24.8094,
        longitude: 120.9906,
        radius: 100,
        address: '新竹市東區光復路二段690號',
        description: '馬偕紀念醫院新竹分院'
      }
    ];
    
    for (const fence of geofences) {
      const result = await db.query(
        `INSERT INTO geofences (user_id, name, type, latitude, longitude, radius, address, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
         ON CONFLICT (user_id, name) DO UPDATE 
         SET latitude = $4, longitude = $5, radius = $6, updated_at = NOW()
         RETURNING id`,
        [user.id, fence.name, fence.type, fence.latitude, fence.longitude, fence.radius, fence.address, fence.description]
      );
      console.log(`✅ Added geofence: ${fence.name} (ID: ${result.rows[0].id})`);
    }
    
    // Add location history
    const now = new Date();
    const locations = [];
    
    // Simulate a path from home to巨城購物中心
    const pathCoordinates = [
      { lat: 24.8050, lng: 120.9650, note: '家裡出發' },
      { lat: 24.8060, lng: 120.9660, note: '步行中' },
      { lat: 24.8070, lng: 120.9670, note: '經過便利商店' },
      { lat: 24.8080, lng: 120.9680, note: '等紅綠燈' },
      { lat: 24.8090, lng: 120.9700, note: '穿越公園' },
      { lat: 24.8100, lng: 120.9730, note: '接近巨城' },
      { lat: 24.8105, lng: 120.9747, note: '抵達巨城購物中心' }
    ];
    
    for (let i = 0; i < pathCoordinates.length; i++) {
      const timestamp = new Date(now.getTime() - (pathCoordinates.length - i) * 5 * 60000); // 5分鐘間隔
      const coord = pathCoordinates[i];
      
      await db.query(
        `INSERT INTO location_history (user_id, latitude, longitude, accuracy, speed, heading, altitude, activity_type, battery_level, is_moving, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user.id, 
          coord.lat, 
          coord.lng, 
          10 + Math.random() * 5, // accuracy 10-15m
          i === 0 || i === pathCoordinates.length - 1 ? 0 : 1.2 + Math.random(), // speed
          90 + Math.random() * 20, // heading
          50 + Math.random() * 10, // altitude
          i === 0 || i === pathCoordinates.length - 1 ? 'stationary' : 'walking',
          85 - i * 2, // battery level decreasing
          i !== 0 && i !== pathCoordinates.length - 1,
          timestamp
        ]
      );
      console.log(`✅ Added location history: ${coord.note}`);
    }
    
    // Add emergency contacts
    const contacts = [
      {
        name: '張美玲',
        relationship: '女兒',
        phone: '0912-345-678',
        email: 'meiling@example.com',
        is_primary: true
      },
      {
        name: '李大明',
        relationship: '兒子',
        phone: '0923-456-789',
        email: 'daming@example.com',
        is_primary: false
      },
      {
        name: '王醫師',
        relationship: '家庭醫師',
        phone: '0934-567-890',
        email: 'dr.wang@hospital.com',
        is_primary: false
      }
    ];
    
    for (const contact of contacts) {
      await db.query(
        `INSERT INTO emergency_contacts (user_id, name, relationship, phone, email, is_primary, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, phone) DO UPDATE 
         SET name = $2, relationship = $3, updated_at = NOW()`,
        [user.id, contact.name, contact.relationship, contact.phone, contact.email, contact.is_primary]
      );
      console.log(`✅ Added emergency contact: ${contact.name} (${contact.relationship})`);
    }
    
    // Add some alerts/notifications
    const alerts = [
      {
        type: 'geofence_exit',
        title: '離開安全區域提醒',
        message: '您已離開「家」的安全範圍',
        data: { geofence_name: '家', exit_time: new Date(now.getTime() - 3600000) }
      },
      {
        type: 'low_battery',
        title: '電量過低警告',
        message: '手機電量低於20%，請儘快充電',
        data: { battery_level: 18 }
      },
      {
        type: 'daily_checkin',
        title: '每日報平安',
        message: '今天還沒有報平安，請點擊確認',
        data: { date: now.toISOString().split('T')[0] }
      }
    ];
    
    for (const alert of alerts) {
      await db.query(
        `INSERT INTO alerts (user_id, type, title, message, data, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())`,
        [user.id, alert.type, alert.title, alert.message, JSON.stringify(alert.data)]
      );
      console.log(`✅ Added alert: ${alert.title}`);
    }
    
    console.log('\n✅ Sample data added successfully!');
    console.log('Test account now has:');
    console.log('- 5 geofenced locations');
    console.log('- 7 location history points (simulated journey)');
    console.log('- 3 emergency contacts');
    console.log('- 3 notifications/alerts');
    
  } catch (error) {
    console.error('Error adding sample data:', error);
  } finally {
    await db.close();
  }
}

addSampleData();
