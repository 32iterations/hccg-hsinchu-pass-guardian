#!/bin/bash
set -euo pipefail

# Deployment script for Hsinchu Pass Guardian
echo "🚀 Hsinchu Pass Guardian - Deployment Script"

# Configuration
ENVIRONMENT="${1:-staging}"
DEPLOY_BRANCH="${2:-main}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEPLOY_TAG="deploy-${ENVIRONMENT}-${TIMESTAMP}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-deployment checks
pre_deploy_checks() {
    log_info "Running pre-deployment checks..."

    # Check git status
    if [[ -n $(git status -s) ]]; then
        log_error "Working directory is not clean. Please commit or stash changes."
        exit 1
    fi

    # Check current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
        log_warn "Not on $DEPLOY_BRANCH branch. Currently on $CURRENT_BRANCH"
        read -p "Continue deployment? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Run tests
    log_info "Running test suite..."
    npm test --silent || {
        log_error "Tests failed. Aborting deployment."
        exit 1
    }

    # Check coverage
    log_info "Checking code coverage..."
    COVERAGE=$(npm run coverage --silent | grep "All files" | awk '{print $10}' | sed 's/%//')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
        log_warn "Coverage is below 80% (current: ${COVERAGE}%)"
    fi

    log_info "Pre-deployment checks passed!"
}

# Build application
build_application() {
    log_info "Building application for ${ENVIRONMENT}..."

    # Clean previous builds
    rm -rf dist build

    # Build backend
    if [ -f "src/backend/package.json" ]; then
        log_info "Building backend services..."
        cd src/backend
        npm run build || npm run compile || echo "No build script found"
        cd ../..
    fi

    # Build frontend (if exists)
    if [ -f "src/app/package.json" ]; then
        log_info "Building frontend application..."
        cd src/app
        npm run build:${ENVIRONMENT} || npm run build
        cd ../..
    fi

    # Create deployment artifact
    log_info "Creating deployment artifact..."
    tar -czf "deploy-${TIMESTAMP}.tar.gz" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.env \
        --exclude=secrets \
        src/ config/ package*.json

    log_info "Build completed successfully!"
}

# Deploy to environment
deploy_to_environment() {
    case $ENVIRONMENT in
        local)
            deploy_local
            ;;
        staging)
            deploy_staging
            ;;
        production)
            deploy_production
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Local deployment
deploy_local() {
    log_info "Deploying to local environment..."

    # Start with docker-compose
    if [ -f "docker-compose.yml" ]; then
        docker-compose down
        docker-compose up -d --build
        docker-compose ps
    else
        log_warn "No docker-compose.yml found. Starting with npm..."
        npm start &
    fi

    log_info "Local deployment complete!"
    log_info "Application available at http://localhost:3000"
}

# Staging deployment
deploy_staging() {
    log_info "Deploying to staging environment..."

    # Tag the deployment
    git tag -a "$DEPLOY_TAG" -m "Deployment to staging at ${TIMESTAMP}"
    git push origin "$DEPLOY_TAG"

    # Deploy using GitHub Actions (trigger workflow)
    if command -v gh &> /dev/null; then
        gh workflow run deploy-staging.yml \
            -f environment=staging \
            -f tag="$DEPLOY_TAG"
    else
        log_warn "GitHub CLI not installed. Please trigger deployment manually."
    fi

    # Health check
    sleep 30
    STAGING_URL="${STAGING_URL:-https://staging.hsinchu-pass.example.com}"
    if curl -sf "${STAGING_URL}/health" > /dev/null; then
        log_info "Staging deployment successful!"
        log_info "Application available at ${STAGING_URL}"
    else
        log_warn "Health check failed. Please verify deployment manually."
    fi
}

# Production deployment
deploy_production() {
    log_info "Deploying to production environment..."

    # Extra confirmation for production
    echo -e "${RED}⚠️  WARNING: You are about to deploy to PRODUCTION!${NC}"
    read -p "Type 'DEPLOY TO PRODUCTION' to confirm: " confirmation
    if [[ "$confirmation" != "DEPLOY TO PRODUCTION" ]]; then
        log_error "Production deployment cancelled."
        exit 1
    fi

    # Create production tag
    PROD_TAG="v$(date +%Y.%m.%d)-${TIMESTAMP:9}"
    git tag -a "$PROD_TAG" -m "Production release ${PROD_TAG}"
    git push origin "$PROD_TAG"

    # Trigger production deployment
    if command -v gh &> /dev/null; then
        gh workflow run deploy-production.yml \
            -f environment=production \
            -f tag="$PROD_TAG" \
            -f rollback_enabled=true
    fi

    log_info "Production deployment initiated with tag ${PROD_TAG}"
    log_info "Monitor deployment at: https://github.com/${GITHUB_REPOSITORY}/actions"
}

# Post-deployment tasks
post_deploy_tasks() {
    log_info "Running post-deployment tasks..."

    # Send notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Deployment to ${ENVIRONMENT} completed successfully!\"}" \
            "$SLACK_WEBHOOK_URL"
    fi

    # Update deployment log
    echo "${TIMESTAMP} - Deployed to ${ENVIRONMENT} (${DEPLOY_TAG})" >> deployments.log

    # Clean up old artifacts
    find . -name "deploy-*.tar.gz" -mtime +7 -delete

    log_info "Post-deployment tasks completed!"
}

# Rollback function
rollback() {
    log_error "Deployment failed! Starting rollback..."

    if [ -n "${PREVIOUS_TAG:-}" ]; then
        git checkout "$PREVIOUS_TAG"
        log_info "Rolled back to ${PREVIOUS_TAG}"
    else
        log_warn "No previous tag found for rollback"
    fi

    exit 1
}

# Set trap for errors
trap rollback ERR

# Main execution
main() {
    echo "========================================="
    echo "Environment: ${ENVIRONMENT}"
    echo "Branch: ${DEPLOY_BRANCH}"
    echo "Timestamp: ${TIMESTAMP}"
    echo "========================================="

    pre_deploy_checks
    build_application
    deploy_to_environment
    post_deploy_tasks

    echo "========================================="
    log_info "✅ Deployment completed successfully!"
    echo "========================================="
}

# Run main function
main "$@"