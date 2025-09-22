const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection for CI environment
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'guardian_test',
  password: process.env.DB_PASSWORD || 'testpassword',
  port: process.env.DB_PORT || 5432,
  // Use connection string if provided
  connectionString: process.env.DATABASE_URL,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock endpoints for performance testing
app.get('/api/cases', async (req, res) => {
  // Mock response for CI testing
  res.json({
    cases: [],
    total: 0,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/mydata', async (req, res) => {
  // Mock response for CI testing
  res.json({
    data: [],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/kpi', async (req, res) => {
  // Mock response for CI testing
  res.json({
    metrics: {
      totalCases: 0,
      activeCases: 0,
      resolvedCases: 0
    },
    timestamp: new Date().toISOString()
  });
});

// Test database connection (non-blocking)
pool.connect((err, client, release) => {
  if (err) {
    console.warn('Warning: Could not connect to database:', err.message);
    console.warn('Running in mock mode without database');
    console.warn('Connection config:', {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_DATABASE || 'guardian_test',
      port: process.env.DB_PORT || 5432,
      hasPassword: !!process.env.DB_PASSWORD,
      connectionString: process.env.DATABASE_URL ? 'set' : 'not set'
    });
  } else {
    console.log('Successfully connected to PostgreSQL database');
    release();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool has ended');
  });
  process.exit(0);
});

// Handle uncaught errors to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // Keep the server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Keep the server running
});