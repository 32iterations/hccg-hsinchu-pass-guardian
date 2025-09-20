const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupTestAccount() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hccg_db',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS hccg_db`);
    await connection.query(`USE hccg_db`);

    // Create guardians table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS guardians (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'guardian',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Hash password
    const hashedPassword = await bcrypt.hash('Test123456', 10);

    // Check if test account exists
    const [existing] = await connection.query(
      'SELECT id FROM guardians WHERE email = ?',
      ['test@example.com']
    );

    if (existing.length > 0) {
      // Update existing account
      await connection.query(
        'UPDATE guardians SET password = ? WHERE email = ?',
        [hashedPassword, 'test@example.com']
      );
      console.log('✅ Test account updated successfully!');
    } else {
      // Insert test account
      await connection.query(
        'INSERT INTO guardians (email, password, name, phone, role) VALUES (?, ?, ?, ?, ?)',
        ['test@example.com', hashedPassword, 'Test User', '0912345678', 'guardian']
      );
      console.log('✅ Test account created successfully!');
    }

    console.log('\n📧 Login credentials:');
    console.log('Email: test@example.com');
    console.log('Password: Test123456');
    console.log('\n🌐 API URL: http://147.251.115.54:3000');
    console.log('Local API: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error setting up test account:', error.message);
  } finally {
    await connection.end();
  }
}

setupTestAccount();