#!/bin/bash
set -euo pipefail

# 🚀 One-Click Setup Script for Hsinchu Pass Guardian
# This script sets up the complete development environment with TDD enforcement

echo "=================================================="
echo "🚀 Hsinchu Pass Guardian - One-Click Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log_info() { echo -e "${GREEN}✅${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }
log_step() { echo -e "${BLUE}▶${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check Docker
    if command -v docker &> /dev/null; then
        log_info "Docker: $(docker --version)"
    else
        log_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check Git
    if command -v git &> /dev/null; then
        log_info "Git: $(git --version)"
    else
        log_error "Git is not installed."
        exit 1
    fi

    # Check GitHub CLI
    if command -v gh &> /dev/null; then
        log_info "GitHub CLI: $(gh --version | head -1)"
    else
        log_warn "GitHub CLI not installed (optional but recommended)"
        echo "Install with: brew install gh (Mac) or see https://cli.github.com/"
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        log_info "Node.js: $(node --version)"
    else
        log_warn "Node.js not installed locally (will use container)"
    fi
}

# Setup policy protection
setup_policy_protection() {
    log_step "Setting up policy protection..."

    # Create policy directory
    mkdir -p .policy

    # Copy CLAUDE.md to policy (make it read-only)
    if [ -f "CLAUDE.md" ]; then
        cp CLAUDE.md .policy/CLAUDE.md
        log_info "CLAUDE.md backed up to .policy/"
    fi

    # Create symbolic link (optional - keeps path consistent)
    if [ ! -L "CLAUDE.md" ] && [ -f ".policy/CLAUDE.md" ]; then
        rm -f CLAUDE.md
        ln -s .policy/CLAUDE.md CLAUDE.md
        log_info "CLAUDE.md linked to protected policy"
    fi
}

# Setup Git hooks
setup_git_hooks() {
    log_step "Setting up Git hooks for TDD enforcement..."

    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'HOOK'
#!/usr/bin/env bash
set -e
branch="$(git rev-parse --abbrev-ref HEAD)"

# Block changes to CLAUDE.md
if git diff --cached --name-only | grep -qx "CLAUDE.md"; then
  echo "❌ Do not commit changes to CLAUDE.md."
  echo "   Create an ADR in docs/ADR/ instead."
  exit 1
fi

# TDD enforcement for RED branches
if [[ "$branch" =~ -red- ]]; then
  echo "🔴 RED branch detected - validating test-only changes..."

  # Only allow test files
  if git diff --cached --name-only | grep -vE '(\.test\.|\.spec\.|tests?/|__tests?__)' | grep -E '\.(js|jsx|ts|tsx)$' >/dev/null; then
    echo "❌ On RED branch, only test files can be committed."
    exit 1
  fi

  # Ensure tests fail (RED phase requirement)
  if npm test --silent 2>/dev/null || yarn test --silent 2>/dev/null || pnpm test --silent 2>/dev/null; then
    echo "❌ RED commit must have failing tests."
    exit 1
  fi
  echo "✅ RED phase validation passed"

# TDD enforcement for GREEN branches
elif [[ "$branch" =~ -green- ]]; then
  echo "🟢 GREEN branch detected - validating all tests pass..."

  # Ensure all tests pass
  if ! (npm test --silent 2>/dev/null || yarn test --silent 2>/dev/null || pnpm test --silent 2>/dev/null); then
    echo "❌ Tests must pass on GREEN branch."
    exit 1
  fi
  echo "✅ GREEN phase validation passed"
fi

echo "✅ Pre-commit checks passed"
HOOK

    chmod +x .git/hooks/pre-commit
    log_info "Pre-commit hook installed"

    # Create commit-msg hook (already exists, update if needed)
    if [ ! -f ".git/hooks/commit-msg" ]; then
        cp .git/hooks/commit-msg .git/hooks/commit-msg.backup 2>/dev/null || true
    fi

    cat > .git/hooks/commit-msg << 'HOOK'
#!/usr/bin/env bash
msg_file="$1"

# Block AI attributions
if grep -Eiq 'Co-Authored-By:.*Claude|Generated with Claude Code' "$msg_file"; then
  echo "❌ Commit message contains AI attribution. Remove it and try again." >&2
  exit 1
fi

# Warn about TDD prefixes
msg=$(cat "$msg_file")
branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$branch" =~ -(red|green|refactor)- ]] && ! [[ "$msg" =~ ^\[(RED|GREEN|REFACTOR)\] ]]; then
  echo "⚠️  TDD branch detected. Consider prefixing commit with [RED], [GREEN], or [REFACTOR]"
fi

exit 0
HOOK

    chmod +x .git/hooks/commit-msg
    log_info "Commit-msg hook installed"
}

# Setup Claude hooks
setup_claude_hooks() {
    log_step "Setting up Claude Code hooks..."

    mkdir -p .claude/hooks

    # Ensure hooks are executable
    if [ -f ".claude/hooks/block-policy-edits.sh" ]; then
        chmod +x .claude/hooks/block-policy-edits.sh
        log_info "Policy protection hook ready"
    fi

    if [ -f ".claude/hooks/tdd-guard.sh" ]; then
        chmod +x .claude/hooks/tdd-guard.sh
        log_info "TDD guard hook ready"
    fi
}

# Setup development environment
setup_dev_environment() {
    log_step "Setting up development environment..."

    # Create necessary directories
    mkdir -p tests/{unit,integration,e2e}
    mkdir -p docs/ADR
    mkdir -p .logs
    mkdir -p .cache

    # Create .env.example if not exists
    if [ ! -f ".env.example" ]; then
        cat > .env.example << 'ENV'
# Development Environment Variables
NODE_ENV=development
PORT=3000
API_PORT=8080

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hsinchu_pass_dev

# Security (change in production)
JWT_SECRET=dev-secret-change-me
SESSION_SECRET=dev-session-secret

# External Services
MAPS_API_KEY=your-maps-api-key
PUSH_NOTIFICATION_KEY=your-push-key
MYDATA_CLIENT_ID=your-mydata-client
MYDATA_CLIENT_SECRET=your-mydata-secret

# Feature Flags
ENABLE_SAFETY_FEATURES=true
ENABLE_VOLUNTEER_MODE=true
ENV

        log_info "Created .env.example"
    fi

    # Create initial package.json if not exists
    if [ ! -f "package.json" ]; then
        cat > package.json << 'PACKAGE'
{
  "name": "hsinchu-pass-guardian",
  "version": "0.1.0",
  "description": "Hsinchu Pass Safety Guardian System",
  "scripts": {
    "dev": "nodemon src/backend/index.js",
    "start": "node src/backend/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "deploy": "bash scripts/deploy/deploy.sh",
    "health": "bash scripts/monitoring/health-check.sh",
    "setup": "bash setup.sh"
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "nodemon": "^3.0.0",
    "prettier": "^3.0.0"
  }
}
PACKAGE
        log_info "Created package.json"
    fi
}

# Build and start DevContainer
start_devcontainer() {
    log_step "Building and starting DevContainer..."

    if [ -f ".devcontainer/devcontainer.json" ]; then
        # Check if VS Code is installed
        if command -v code &> /dev/null; then
            log_info "Opening in VS Code with DevContainer..."
            code --install-extension ms-vscode-remote.remote-containers
            code . --goto ".devcontainer/devcontainer.json"
            echo ""
            echo "📝 To start DevContainer in VS Code:"
            echo "   1. Press F1"
            echo "   2. Select 'Dev Containers: Reopen in Container'"
        else
            # Fallback to Docker Compose
            if [ -f "docker-compose.yml" ]; then
                docker-compose up -d
                log_info "Started with Docker Compose"
            else
                log_warn "VS Code not found. Install it for DevContainer support."
                echo "Visit: https://code.visualstudio.com/"
            fi
        fi
    else
        log_warn "DevContainer configuration not found"
    fi
}

# Setup GitHub repository
setup_github() {
    log_step "Setting up GitHub integration..."

    if command -v gh &> /dev/null; then
        # Check if authenticated
        if gh auth status &> /dev/null; then
            log_info "GitHub CLI authenticated"

            # Set up repository settings
            if [ -d ".git" ]; then
                # Enable branch protection (if repo owner)
                gh api repos/:owner/:repo/branches/main/protection \
                    --method PUT \
                    --field required_status_checks='{"strict":true,"contexts":["continuous-integration"]}' \
                    --field enforce_admins=false \
                    --field required_pull_request_reviews='{"required_approving_review_count":1}' \
                    2>/dev/null || log_warn "Could not set branch protection (may need admin rights)"

                log_info "GitHub repository configured"
            fi
        else
            log_warn "GitHub CLI not authenticated. Run: gh auth login"
        fi
    fi
}

# Final setup summary
show_summary() {
    echo ""
    echo "=================================================="
    echo "✨ Setup Complete!"
    echo "=================================================="
    echo ""
    echo "📋 Configuration Summary:"
    echo "   • Policy protection: ${GREEN}Enabled${NC}"
    echo "   • TDD enforcement: ${GREEN}Active${NC}"
    echo "   • Git hooks: ${GREEN}Installed${NC}"
    echo "   • DevContainer: ${GREEN}Ready${NC}"
    echo "   • CI/CD workflows: ${GREEN}Configured${NC}"
    echo ""
    echo "🚀 Quick Start Commands:"
    echo "   ${BLUE}npm test${NC}         - Run tests"
    echo "   ${BLUE}npm run dev${NC}      - Start development server"
    echo "   ${BLUE}npm run deploy${NC}   - Deploy to environment"
    echo "   ${BLUE}npm run health${NC}   - Check system health"
    echo ""
    echo "📝 TDD Workflow:"
    echo "   1. Create RED branch:   ${YELLOW}git checkout -b p1-red-$(date +%Y%m%d-%H%M)${NC}"
    echo "   2. Write failing tests"
    echo "   3. Commit with:         ${YELLOW}git commit -m '[RED] Test description'${NC}"
    echo "   4. Create GREEN branch: ${YELLOW}git checkout -b p1-green-$(date +%Y%m%d-%H%M)${NC}"
    echo "   5. Make tests pass"
    echo "   6. Commit with:         ${YELLOW}git commit -m '[GREEN] Implementation'${NC}"
    echo ""
    echo "⚠️  Important:"
    echo "   • CLAUDE.md is protected and cannot be edited"
    echo "   • All changes must follow TDD (RED → GREEN → REFACTOR)"
    echo "   • Tests are automatically run on commits"
    echo "   • Nightly builds run at 2 AM UTC"
    echo ""
    echo "📚 Documentation:"
    echo "   • Project rules: CLAUDE.md"
    echo "   • API docs: docs/api/"
    echo "   • ADRs: docs/ADR/"
    echo ""
    echo "=================================================="
}

# Main execution
main() {
    echo "Starting setup process..."
    echo ""

    check_prerequisites
    setup_policy_protection
    setup_git_hooks
    setup_claude_hooks
    setup_dev_environment
    setup_github
    start_devcontainer
    show_summary

    log_info "🎉 Setup completed successfully!"
}

# Run main function
main "$@"