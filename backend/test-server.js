const express = require('express');
const app = express();

app.use(express.json());

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock endpoints for performance testing
app.get('/api/cases', (req, res) => {
  res.json({
    cases: [],
    total: 0,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/mydata', (req, res) => {
  res.json({
    data: [],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/kpi', (req, res) => {
  res.json({
    metrics: {
      totalCases: 0,
      activeCases: 0,
      resolvedCases: 0
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Test server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Keep the process running
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});