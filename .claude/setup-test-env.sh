#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Setting up complete test environment..."

# 1. Create in-memory SQLite database for testing (no external deps)
echo "📦 Installing SQLite3 for testing..."
npm install --save-dev sqlite3 better-sqlite3 2>/dev/null || true

# 2. Create test environment configuration
echo "🔧 Creating test environment configuration..."
cat > .env.test << 'EOF'
NODE_ENV=test
DATABASE_TYPE=sqlite
DATABASE_URL=:memory:
JWT_SECRET=test-jwt-secret-key-2025
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
API_KEY=test-api-key-hccg
CORS_ORIGIN=*
LOG_LEVEL=error
PORT=3001
EOF

# 3. Create database setup script
echo "🗄️ Creating database initialization script..."
cat > .claude/db-setup.js << 'EOF'
const Database = require('better-sqlite3');

class TestDatabase {
  constructor() {
    this.db = new Database(':memory:', { verbose: console.log });
    this.initTables();
  }

  initTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cases table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        priority TEXT DEFAULT 'medium',
        created_by INTEGER,
        assigned_to INTEGER,
        location_lat REAL,
        location_lng REAL,
        location_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )
    `);

    // Devices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_number TEXT UNIQUE NOT NULL,
        manufacturer TEXT,
        model TEXT,
        ncc_certification TEXT,
        battery_level INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Geofences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS geofences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        center_lat REAL NOT NULL,
        center_lng REAL NOT NULL,
        radius INTEGER NOT NULL,
        accuracy INTEGER DEFAULT 10,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Seed test data
    this.seedData();
  }

  seedData() {
    // Insert test users
    const stmt = this.db.prepare('INSERT OR IGNORE INTO users (email, password, role) VALUES (?, ?, ?)');
    stmt.run('admin@test.com', '$2b$10$test', 'admin');
    stmt.run('family@test.com', '$2b$10$test', 'family');
    stmt.run('volunteer@test.com', '$2b$10$test', 'volunteer');
  }

  close() {
    this.db.close();
  }
}

module.exports = TestDatabase;
EOF

# 4. Create mock authentication service
echo "🔐 Creating mock authentication service..."
cat > .claude/mock-auth.js << 'EOF'
const jwt = require('jsonwebtoken');

class MockAuthService {
  constructor() {
    this.secret = process.env.JWT_SECRET || 'test-secret';
    this.tokens = new Map([
      ['admin-token', { id: 1, email: 'admin@test.com', role: 'admin' }],
      ['family-member-token', { id: 2, email: 'family@test.com', role: 'family' }],
      ['volunteer-token', { id: 3, email: 'volunteer@test.com', role: 'volunteer' }]
    ]);
  }

  generateToken(user) {
    return jwt.sign(user, this.secret, { expiresIn: '24h' });
  }

  verifyToken(token) {
    // Check predefined tokens first
    if (this.tokens.has(token)) {
      return this.tokens.get(token);
    }

    // Try to verify as JWT
    try {
      if (token && token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      // Check if it's a mock token
      if (this.tokens.has(token)) {
        return this.tokens.get(token);
      }

      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  authenticate(req, res, next) {
    const token = req.headers.authorization;

    try {
      const user = this.verifyToken(token);
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  requireRole(role) {
    return (req, res, next) => {
      if (req.user && req.user.role === role) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden' });
      }
    };
  }
}

module.exports = MockAuthService;
EOF

# 5. Update test setup configuration
echo "🧪 Updating test setup configuration..."
cat > src/backend/tests/setup/test-setup.config.js << 'EOF'
const TestDatabase = require('../../../../.claude/db-setup');
const MockAuthService = require('../../../../.claude/mock-auth');

// Load test environment
require('dotenv').config({ path: '.env.test' });

// Global test database
global.testDb = null;
global.mockAuth = null;

beforeAll(() => {
  // Initialize test database
  global.testDb = new TestDatabase();

  // Initialize mock auth
  global.mockAuth = new MockAuthService();

  // Mock console methods to reduce noise
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Clean up
  if (global.testDb) {
    global.testDb.close();
  }
});

// Mock shared middleware to use our test services
jest.mock('../../src/middleware/shared', () => ({
  authMiddleware: {
    authenticate: (req, res, next) => {
      if (global.mockAuth) {
        return global.mockAuth.authenticate(req, res, next);
      }
      next();
    },
    requireRole: (role) => {
      if (global.mockAuth) {
        return global.mockAuth.requireRole(role);
      }
      return (req, res, next) => next();
    }
  },
  validationMiddleware: {
    validate: () => (req, res, next) => next(),
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next()
  },
  errorMiddleware: {
    requestId: () => (req, res, next) => {
      req.id = 'test-request-id';
      next();
    },
    handleError: () => (err, req, res, next) => {
      res.status(err.status || 500).json({ error: err.message });
    }
  },
  securityMiddleware: {
    helmet: () => (req, res, next) => next(),
    cors: () => (req, res, next) => next(),
    rateLimit: () => (req, res, next) => next(),
    authRateLimit: () => (req, res, next) => next(),
    apiRateLimit: () => (req, res, next) => next(),
    requestSizeLimit: () => (req, res, next) => next(),
    validateContentType: () => (req, res, next) => next()
  }
}));

module.exports = {
  testDb: () => global.testDb,
  mockAuth: () => global.mockAuth
};
EOF

# 6. Install required dependencies
echo "📦 Installing required dependencies..."
npm install --save-dev \
  jsonwebtoken \
  bcrypt \
  supertest \
  express \
  compression \
  morgan \
  dotenv \
  2>/dev/null || true

# 7. Create a test runner script
echo "🏃 Creating test runner script..."
cat > .claude/run-tests.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Running complete test suite with full backend environment..."

# Load test environment
export NODE_ENV=test
source .env.test

# Run tests with proper configuration
npm test -- \
  --setupFilesAfterEnv="<rootDir>/src/backend/tests/setup/test-setup.config.js" \
  --testTimeout=30000 \
  --maxWorkers=1 \
  --runInBand \
  --forceExit

echo "✅ Test run complete!"
EOF

chmod +x .claude/run-tests.sh

echo "✅ Test environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Run: source .env.test"
echo "2. Run: .claude/run-tests.sh"
echo ""
echo "🎯 The setup includes:"
echo "   - In-memory SQLite database (no external dependencies)"
echo "   - Mock authentication service"
echo "   - Test data seeding"
echo "   - All required middleware mocks"
echo "   - Environment configuration"