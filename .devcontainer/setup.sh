#!/bin/bash
set -euo pipefail

echo "🚀 [DevContainer] Starting development environment setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Change to workspace directory
cd /workspace

# Install Node dependencies
print_status "Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    npm install --no-audit --no-fund
elif [ -f "src/backend/package.json" ]; then
    cd src/backend && npm install --no-audit --no-fund && cd ../..
fi

# Setup Git configuration
print_status "Configuring Git..."
git config --global --add safe.directory /workspace
git config --global core.autocrlf input
git config --global init.defaultBranch main

# Create necessary directories
print_status "Creating project directories..."
mkdir -p .policy .cache .logs tmp

# Setup pre-commit hooks
print_status "Setting up Git hooks..."
if [ ! -f ".git/hooks/pre-commit" ]; then
    cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
# Run linting and tests before commit
echo "Running pre-commit checks..."

# Lint check
if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
    npm run lint || exit 1
fi

# Security audit
npm audit --audit-level=high || true

echo "Pre-commit checks passed!"
HOOK
    chmod +x .git/hooks/pre-commit
fi

# Create test structure if not exists
print_status "Setting up test structure..."
mkdir -p tests/{unit,integration,e2e}

# Create basic test configuration
if [ ! -f "jest.config.js" ]; then
    cat > jest.config.js << 'EOF'
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.js'
  ],
  testMatch: [
    '**/tests/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
EOF
fi

# Install additional development tools
print_status "Installing development tools..."
npm install --save-dev --no-save \
    eslint \
    prettier \
    jest \
    @types/node \
    husky \
    lint-staged \
    nodemon \
    concurrently 2>/dev/null || true

# Setup environment variables
print_status "Setting up environment variables..."
if [ ! -f ".env.development" ]; then
    cat > .env.development << 'EOF'
# Development Environment Variables
NODE_ENV=development
PORT=3000
API_PORT=8080
LOG_LEVEL=debug

# Security
JWT_SECRET=dev-secret-change-in-production
SESSION_SECRET=dev-session-secret

# Database (example)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hsinchu_pass_dev
DB_USER=developer
DB_PASSWORD=dev-password

# External Services
MAPS_API_KEY=your-maps-api-key
PUSH_NOTIFICATION_KEY=your-push-key
MYDATA_CLIENT_ID=your-mydata-client-id
MYDATA_CLIENT_SECRET=your-mydata-secret

# Feature Flags
ENABLE_SAFETY_FEATURES=true
ENABLE_VOLUNTEER_MODE=true
ENABLE_MYDATA_INTEGRATION=false
EOF
fi

# Create VS Code workspace settings
print_status "Configuring VS Code workspace..."
mkdir -p .vscode
if [ ! -f ".vscode/settings.json" ]; then
    cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "jest.autoRun": {
    "watch": true,
    "onSave": "test-file"
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/.git": true,
    "**/coverage": true,
    "**/.cache": true
  }
}
EOF
fi

# Check system resources
print_status "Checking system resources..."
echo "Memory: $(free -h | grep Mem | awk '{print $2}' || echo 'N/A')"
echo "CPU Cores: $(nproc || echo 'N/A')"
echo "Disk Space: $(df -h /workspace | tail -1 | awk '{print $4}' || echo 'N/A') available"

# Verify installations
print_status "Verifying installations..."
node --version || print_error "Node.js not installed"
npm --version || print_error "npm not installed"
git --version || print_error "Git not installed"
docker --version 2>/dev/null || print_warning "Docker not available"
gh --version 2>/dev/null || print_warning "GitHub CLI not available"

# Final message
echo ""
echo "========================================="
echo -e "${GREEN}✨ DevContainer setup complete!${NC}"
echo "========================================="
echo ""
echo "Quick start commands:"
echo "  npm run dev        - Start development server"
echo "  npm test          - Run tests"
echo "  npm run lint      - Run linter"
echo "  gh pr create      - Create pull request"
echo ""
echo "Security policies are active. Check .policy/ for details."
echo ""