const { Pool } = require('pg');
require('dotenv').config();

describe('Database Connection Tests', () => {
  let db;

  beforeAll(() => {
    db = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'hsinchu_guardian',
      user: 'guardian_user',
      password: 'guardian2025',
    });
  });

  afterAll(async () => {
    if (db) {
      await db.end();
    }
  });

  test('should connect to PostgreSQL database', async () => {
    const result = await db.query('SELECT NOW() as current_time');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].current_time).toBeInstanceOf(Date);
  });

  test('should have all required tables', async () => {
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tableNames = tables.rows.map(row => row.table_name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('patients');
    expect(tableNames).toContain('locations');
    expect(tableNames).toContain('geofences');
    expect(tableNames).toContain('alerts');
    expect(tableNames).toContain('beacon_status');
  });

  test('should have correct users table structure', async () => {
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    const columnNames = columns.rows.map(row => row.column_name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('email');
    expect(columnNames).toContain('password_hash');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('role');
    expect(columnNames).toContain('created_at');
  });

  test('should have proper indexes', async () => {
    const indexes = await db.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('users', 'patients', 'locations', 'alerts')
    `);

    const indexNames = indexes.rows.map(row => row.indexname);

    expect(indexNames).toContain('idx_locations_patient_time');
    expect(indexNames).toContain('idx_alerts_patient');
    expect(indexNames).toContain('idx_patients_guardian');
  });

  test('should enforce foreign key constraints', async () => {
    // Test that we cannot insert patient without valid guardian_id
    await expect(
      db.query(`
        INSERT INTO patients (name, guardian_id)
        VALUES ('Test Patient', 99999)
      `)
    ).rejects.toThrow();
  });
});