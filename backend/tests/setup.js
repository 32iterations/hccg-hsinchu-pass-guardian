const { Pool } = require('pg');
require('dotenv').config();

// Create test database connection
const testDbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'hsinchu_guardian',
  user: 'guardian_user',
  password: 'guardian2025',
};

let testDb;

beforeAll(async () => {
  testDb = new Pool(testDbConfig);

  // Test database connection
  try {
    await testDb.query('SELECT NOW()');
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Test database connection failed:', error.message);
    throw error;
  }
});

afterAll(async () => {
  if (testDb) {
    await testDb.end();
  }
});

// Clean up database before each test
beforeEach(async () => {
  if (testDb) {
    await testDb.query('TRUNCATE TABLE locations, alerts, geofences, patients, users RESTART IDENTITY CASCADE');
  }
});

global.testDb = testDb;