# Branch Protection Rules Configuration

This document outlines the recommended branch protection rules for the repository.

## Main Branch Protection

Configure the following settings for the `main` branch:

### Required Status Checks
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

#### Required Checks:
- `code-quality`
- `unit-tests (backend)`
- `unit-tests (frontend)`
- `unit-tests (mobile)`
- `integration-tests`
- `e2e-tests`
- `coverage-gate`
- `build (backend)`
- `build (frontend)`
- `build (mobile)`
- `security-scan`

### Pull Request Rules
- ✅ Require pull request reviews before merging
- ✅ Required number of reviewers: 2
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require review from code owners

### Additional Rules
- ✅ Restrict pushes that create files larger than 100 MB
- ✅ Require signed commits
- ✅ Include administrators in restrictions

## Develop Branch Protection

Configure the following settings for the `develop` branch:

### Required Status Checks
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

#### Required Checks:
- `code-quality`
- `unit-tests (backend)`
- `coverage-gate`

### Pull Request Rules
- ✅ Require pull request reviews before merging
- ✅ Required number of reviewers: 1

## Feature Branch Naming Convention

Enforce the following branch naming patterns:
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical fixes
- `release/*` - Release preparation
- `p1-*` - Phase 1 development branches

## Configuration Command

Run this command in the repository to apply these settings via GitHub CLI:

```bash
# Main branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["code-quality","unit-tests (backend)","unit-tests (frontend)","unit-tests (mobile)","integration-tests","e2e-tests","coverage-gate","build (backend)","build (frontend)","build (mobile)","security-scan"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null

# Develop branch protection
gh api repos/:owner/:repo/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["code-quality","unit-tests (backend)","coverage-gate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```