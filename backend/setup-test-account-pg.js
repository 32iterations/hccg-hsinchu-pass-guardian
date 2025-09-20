const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

async function setupTestAccount() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    user: 'guardian_user',
    password: 'guardian2025',
    database: 'hsinchu_guardian',
    port: process.env.DB_PORT || 5432
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create guardians table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS guardians (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'guardian',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Guardians table ready');

    // Hash password
    const hashedPassword = await bcrypt.hash('Test123456', 10);

    // Check if test account exists
    const existing = await client.query(
      'SELECT id FROM guardians WHERE email = $1',
      ['test@example.com']
    );

    if (existing.rows.length > 0) {
      // Update existing account
      await client.query(
        'UPDATE guardians SET password = $1, name = $2, phone = $3 WHERE email = $4',
        [hashedPassword, 'Test User', '0912345678', 'test@example.com']
      );
      console.log('✅ Test account updated successfully!');
    } else {
      // Insert test account
      await client.query(
        'INSERT INTO guardians (email, password, name, phone, role) VALUES ($1, $2, $3, $4, $5)',
        ['test@example.com', hashedPassword, 'Test User', '0912345678', 'guardian']
      );
      console.log('✅ Test account created successfully!');
    }

    // Create another test account for demo
    const demoExists = await client.query(
      'SELECT id FROM guardians WHERE email = $1',
      ['demo@hsinchu.com']
    );

    if (demoExists.rows.length === 0) {
      const demoPassword = await bcrypt.hash('Demo2025', 10);
      await client.query(
        'INSERT INTO guardians (email, password, name, phone, role) VALUES ($1, $2, $3, $4, $5)',
        ['demo@hsinchu.com', demoPassword, 'Demo Guardian', '0987654321', 'guardian']
      );
      console.log('✅ Demo account created!');
    }

    console.log('\n📧 登入帳號資訊:');
    console.log('=====================================');
    console.log('測試帳號 1:');
    console.log('  Email: test@example.com');
    console.log('  密碼: Test123456');
    console.log('');
    console.log('測試帳號 2:');
    console.log('  Email: demo@hsinchu.com');
    console.log('  密碼: Demo2025');
    console.log('=====================================');
    console.log('\n🌐 API URLs:');
    console.log('  外部: http://147.251.115.54:3000');
    console.log('  本地: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error setting up test account:', error.message);
  } finally {
    await client.end();
  }
}

setupTestAccount();