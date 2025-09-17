# Overnight Autopilot - TDD Safety Guardian Implementation

## Mission Critical Constraints
**DO NOT MODIFY**: `CLAUDE.md`, `.policy/**`, or any policy files. These are read-only mounted.

## Goal
Complete P1 Family MVP: "Care Recipient Card + Device Binding" and "Geofence Engine Minimal Implementation" following strict TDD (RED→GREEN→REFACTOR).

## Hard Rules
1. **Policy Protection**: Never edit `CLAUDE.md` or `.policy/**`. If changes needed, create `docs/ADR/0001-claude-amendment.md`
2. **Command Restrictions**: Only use:
   - Git: `status`, `diff`, `add`, `commit`, `push`, `checkout`, `branch`
   - Test: Auto-detect (`npm test`, `yarn test`, `pnpm test`, `./gradlew test`, `xcodebuild test`)
   - Quality: `lint`, `format`, `coverage`
   - **FORBIDDEN**: `curl`, `wget`, `chmod`, `ssh`, `scp`, `sudo`, `mount`
3. **TDD Enforcement**:
   - RED: Create failing tests ONLY in `p1-red-YYYYMMDD-HHMM` branch
   - GREEN: Minimal implementation in `p1-green-YYYYMMDD-HHMM` branch
   - REFACTOR: Improve code while keeping tests green
4. **Commit Standards**:
   - Prefix with `[RED]`, `[GREEN]`, or `[REFACTOR]`
   - No AI attributions
   - Clear scope and rationale

## Implementation Tasks

### Phase 1: Environment Detection (30 min)
```bash
# Auto-detect project type and test framework
if [ -f "package.json" ]; then TEST_CMD="npm test"
elif [ -f "build.gradle" ]; then TEST_CMD="./gradlew test"
elif [ -f "*.xcodeproj" ]; then TEST_CMD="xcodebuild test"
fi

# Verify test framework exists or create minimal setup
```

### Phase 2: Device Binding Tests [RED] (1 hour)
Create failing tests for:
- **NCC Certification Validation**
  - Block devices without NCC type approval number
  - Validate format: `CCAM[YY][XX][####]`
  - Display Chinese regulatory warning
- **Serial Number Management**
  - Prevent duplicate SN registration
  - Validate SN format per manufacturer spec
- **BLE Connection Resilience**
  - Auto-retry on connection failure (3 attempts)
  - Graceful degradation on persistent failure
  - Background reconnection strategy

Test file: `tests/unit/device-binding.test.js`

### Phase 3: Geofence Engine Tests [RED] (1 hour)
Create failing tests for:
- **Boundary Events**
  - Entry detection within 10m accuracy
  - Exit detection with 30s delay
  - Dwell time tracking (5+ minutes)
- **Cooldown Logic**
  - Prevent notification spam (5 min cooldown)
  - Multiple geofence priority handling
- **Performance**
  - Handle 100+ simultaneous geofences
  - Battery-efficient monitoring

Test file: `tests/unit/geofence-engine.test.js`

### Phase 4: Implementation [GREEN] (2 hours)
Minimal viable code to pass all tests:
- `src/backend/services/safety/device/DeviceBindingService.js`
- `src/backend/services/safety/geofence/GeofenceEngine.js`

### Phase 5: Refactoring [REFACTOR] (30 min)
- Extract constants
- Improve error messages
- Add JSDoc comments
- Ensure 80%+ coverage

### Phase 6: Documentation & PR (30 min)
Generate `REPORT.md`:
```markdown
# TDD Implementation Report

## Date: YYYY-MM-DD HH:MM

## Features Implemented
- [x] Device Binding with NCC validation
- [x] Duplicate SN prevention
- [x] BLE resilience handling
- [x] Geofence entry/exit detection
- [x] Cooldown mechanism
- [ ] Push notification integration (next phase)

## Test Summary
- Total Tests: XX
- Passing: XX
- Coverage: XX%

## Key Changes
- Added DeviceBindingService with certification checks
- Implemented GeofenceEngine with boundary detection
- Created resilient BLE connection handler

## Risk Assessment
- No real credentials used (all mocked)
- No PII in test data
- Compliant with platform policies

## Next Steps
- Integrate with push notification service
- Add family member management
- Implement volunteer matching
```

## Execution Sequence

```bash
# 1. Setup and detect
git checkout main
git pull origin main
TIMESTAMP=$(date +%Y%m%d-%H%M)

# 2. RED Phase
git checkout -b "p1-red-${TIMESTAMP}"
# Create all failing tests
npm test # Confirm failures
git add tests/
git commit -m "[RED] Add failing tests for device binding and geofence"
git push origin "p1-red-${TIMESTAMP}"

# 3. GREEN Phase
git checkout -b "p1-green-${TIMESTAMP}"
# Implement minimal code
npm test # Confirm passing
git add src/
git commit -m "[GREEN] Implement device binding and geofence engine"
git push origin "p1-green-${TIMESTAMP}"

# 4. REFACTOR Phase (if needed)
# Improve code quality
npm run lint --fix
npm test # Ensure still passing
git add .
git commit -m "[REFACTOR] Clean up and optimize implementation"
git push

# 5. Create PR
gh pr create \
  --title "[P1] Device binding & Geofence MVP (TDD)" \
  --body-file REPORT.md \
  --base main
```

## Success Criteria
- [ ] All tests created follow RED-GREEN-REFACTOR
- [ ] No modifications to CLAUDE.md or .policy/
- [ ] Coverage ≥ 80%
- [ ] PR created with comprehensive report
- [ ] No security credentials exposed
- [ ] Compliant with iOS/Android platform policies

## Error Recovery
If blocked by policy:
1. Create `docs/ADR/0001-policy-exception.md` documenting the issue
2. Implement workaround without violating core rules
3. Note in REPORT.md for human review

## Time Estimate
Total: ~5-6 hours unattended execution
- Detection & Setup: 30 min
- RED Phase: 2 hours
- GREEN Phase: 2 hours
- REFACTOR & Report: 1 hour

---
**Remember**: This is TDD. Tests first, implementation second. Never skip RED phase.