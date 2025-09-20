#!/usr/bin/env node

/**
 * CI Server Entry Point
 * Simple server for CI/CD environments without Firebase dependencies
 */

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

// Add a basic health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: 'ci',
    message: 'Server is running for performance testing'
  });
});

// Add a root route for Lighthouse to audit
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hsinchu Pass Guardian API</title>
      <meta name="description" content="Hsinchu Pass Guardian API Server for CI Testing">
    </head>
    <body>
      <h1>Hsinchu Pass Guardian API</h1>
      <p>This is the API server running in CI environment for performance testing.</p>
      <nav>
        <ul>
          <li><a href="/health">Health Check</a></li>
          <li><a href="/api/v1">API Base</a></li>
        </ul>
      </nav>
      <script>
        console.log('Page loaded successfully at', new Date().toISOString());
      </script>
    </body>
    </html>
  `);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 CI Server running on port ${PORT}`);
  console.log(`📋 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Base URL: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('CI Server terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('CI Server terminated');
    process.exit(0);
  });
});

module.exports = server;