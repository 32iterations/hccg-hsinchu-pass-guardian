# Requirements Traceability Matrix - HCCG Pass Guardian

## Executive Summary

**Overall Status**: ⚠️ **PARTIAL IMPLEMENTATION - SIGNIFICANT GAPS IDENTIFIED**

**Test Status**: 🚨 **MULTIPLE FAILING TESTS** - System not production ready

**Coverage**: 📊 **55.31%** (Backend), **28.96%** (Mobile) - Below 80% requirement

---

## P1 Family MVP Requirements (overnight.md)

### ✅ IMPLEMENTED AND TESTED
| Requirement | Status | Implementation | Test File | Coverage |
|-------------|--------|----------------|-----------|----------|
| Basic TDD Structure | ✅ COMPLETE | RED→GREEN→REFACTOR branches implemented | Multiple test files | 55%+ |
| Geofence Service Core | ✅ COMPLETE | `/src/backend/services/safety/geofence/GeofenceService.js` | `geofence-engine.service.test.js` | ✅ |
| Express.js REST API | ✅ COMPLETE | `/src/backend/src/app.js` | Integration tests | ✅ |

### 🚨 TDD FAILING (implemented but tests fail)
| Requirement | Status | Issue | Test File | Action Needed |
|-------------|--------|-------|-----------|---------------|
| BLE Scanner Service | 🚨 FAILING | `Cannot read properties of undefined (reading 'has')` | `ble-scanner.service.test.js` | Fix MAC rotation handling |
| Device Binding | 🚨 FAILING | Missing NCC validation logic | `device-binding.service.test.js` | Implement NCC format validation |
| Geofence Engine Accuracy | 🚨 FAILING | Distance calculation errors | `geofence-engine.service.test.js` | Fix 10m accuracy requirement |

### ❌ NOT IMPLEMENTED (missing entirely)
| Requirement | Priority | Missing Component | Expected Location | Specification |
|-------------|----------|-------------------|-------------------|---------------|
| NCC Certification Validation | **HIGH** | Validation logic for `CCAM[YY][XX][####]` format | `DeviceBindingService.js` | Block non-certified devices |
| Chinese Regulatory Warning | **HIGH** | UI warning display | Frontend components | Show certification notice |
| Serial Number Deduplication | **HIGH** | Database constraint + validation | Device repository | Prevent duplicate SN registration |
| BLE Connection Resilience | **MEDIUM** | Auto-retry mechanism (3 attempts) | BLE scanner service | Background reconnection |
| Geofence 10m Accuracy | **HIGH** | GPS/network location fusion | Geofence engine | Entry detection ≤10m |
| Notification Cooldown | **MEDIUM** | 5-minute spam prevention | Geo alert service | Prevent notification flooding |
| Dwell Time Tracking | **MEDIUM** | 5+ minute presence detection | Geofence service | Track residence duration |

---

## P2 Volunteer BLE Requirements (overnight-p2.md)

### ✅ IMPLEMENTED AND TESTED
| Requirement | Status | Implementation | Test File | Coverage |
|-------------|--------|----------------|-----------|----------|
| Basic BLE Scanner | ✅ PARTIAL | `BLEScannerService.js` | `ble-scanner.service.test.js` | 🚨 FAILING |
| Volunteer Consent Service | ✅ COMPLETE | `VolunteerConsentService.js` | Unit tests | ✅ |

### ⚠️ PARTIALLY IMPLEMENTED (needs completion)
| Requirement | Status | Missing Component | Current Implementation | Gap |
|-------------|--------|-------------------|------------------------|-----|
| Android 12+ Permissions | ⚠️ PARTIAL | `neverForLocation` vs location-based scanning | Basic permission check | Platform-specific permission flows |
| iOS State Preservation | ⚠️ PARTIAL | CBCentralManager restoration callbacks | Basic iOS BLE | State restoration on app kill |
| Anonymization | ⚠️ PARTIAL | Device hash irreversibility validation | Basic hashing | Cryptographic security validation |
| Geo Alerts without PII | ⚠️ PARTIAL | Content validation for notifications | Basic notification | PII detection and filtering |

### ❌ NOT IMPLEMENTED (missing entirely)
| Requirement | Priority | Missing Component | Expected Location | Specification |
|-------------|----------|-------------------|-------------------|---------------|
| Gherkin Features | **HIGH** | `features/consent.feature`, `features/ble_scan.feature` | `/features/` directory | BDD test scenarios |
| MAC Rotation Handling | **HIGH** | Device identity persistence across MAC changes | BLE scanner | iOS/Android MAC privacy |
| Hit Clustering | **HIGH** | Spatial-temporal aggregation of volunteer hits | Server aggregation | Combine nearby detections |
| Background Location (Always) | **MEDIUM** | iOS background location permission flow | Mobile permission service | Persistent location access |
| City Node Integration | **LOW** | BLE gateway communication protocol | Server API | Municipal infrastructure |

---

## P3 MyData Integration Requirements (overnight-p3.md)

### ✅ IMPLEMENTED AND TESTED
| Requirement | Status | Implementation | Test File | Coverage |
|-------------|--------|----------------|-----------|----------|
| MyData Adapter Base | ✅ COMPLETE | `MyDataAdapter.js` | `mydata-adapter.test.js` | ✅ |
| OAuth Flow | ✅ COMPLETE | Authorization URL generation | Contract tests | ✅ |

### ⚠️ PARTIALLY IMPLEMENTED (needs completion)
| Requirement | Status | Missing Component | Current Implementation | Gap |
|-------------|--------|-------------------|------------------------|-----|
| TTL Data Retention | ⚠️ PARTIAL | Automated cleanup jobs | Basic retention service | Configurable TTL + cron jobs |
| Contract Validation | ⚠️ PARTIAL | Schema validation for callbacks | Basic callback handling | JSON schema enforcement |
| Audit Trail | ⚠️ PARTIAL | Comprehensive operation logging | Basic audit service | Complete audit coverage |

### ❌ NOT IMPLEMENTED (missing entirely)
| Requirement | Priority | Missing Component | Expected Location | Specification |
|-------------|----------|-------------------|-------------------|---------------|
| Nonce/Timestamp Replay Protection | **HIGH** | Anti-replay attack validation | MyData callback handler | Prevent duplicate requests |
| Receipt Progress Tracking | **HIGH** | Status updates (受理、審核、核發) | MyData tracking service | Real-time progress updates |
| Immediate Revocation | **HIGH** | Data deletion on user revocation | Revocation service | `410 Gone` response |
| Contract Schema Files | **HIGH** | `contracts/mydata.callback.json` | `/contracts/` directory | JSON schema definitions |
| Signature Validation | **MEDIUM** | Cryptographic signature verification | MyData security | Ensure data integrity |

---

## P4 Console RBAC Requirements (overnight-p4.md)

### ✅ IMPLEMENTED AND TESTED
| Requirement | Status | Implementation | Test File | Coverage |
|-------------|--------|----------------|-----------|----------|
| Basic RBAC Service | ✅ COMPLETE | `RBACService.js` | `rbac.service.test.js` | ✅ |
| Role Definitions | ✅ COMPLETE | Viewer/Operator/Admin roles | Role configuration | ✅ |
| Case Flow Service | ✅ COMPLETE | `CaseFlowService.js` | `case-flow.service.test.js` | ✅ |

### ⚠️ PARTIALLY IMPLEMENTED (needs completion)
| Requirement | Status | Missing Component | Current Implementation | Gap |
|-------------|--------|-------------------|------------------------|-----|
| Column Visibility Control | ⚠️ PARTIAL | Dynamic column filtering by role | Static role permissions | Runtime column access control |
| Export Watermarking | ⚠️ PARTIAL | Automatic watermark injection | Basic export functionality | User/timestamp/purpose watermarks |
| KPI Aggregation | ⚠️ PARTIAL | De-identified statistical reporting | Basic KPI service | Prevent individual record drilldown |

### ❌ NOT IMPLEMENTED (missing entirely)
| Requirement | Priority | Missing Component | Expected Location | Specification |
|-------------|----------|-------------------|-------------------|---------------|
| Gherkin BDD Tests | **HIGH** | `features/rbac.feature`, `features/case_flow.feature` | `/features/` directory | Behavior-driven test scenarios |
| E2E Web Testing | **HIGH** | Playwright/Cypress tests | `/tests/e2e/` | Console UI automation tests |
| Audit Log Immutability | **HIGH** | Append-only audit storage | Audit service | Tamper-proof logging |
| Single-Record Access Prevention | **HIGH** | Query restrictions for individual records | Data access layer | Only allow aggregated queries |
| Case Lifecycle Auto-cleanup | **MEDIUM** | Data minimization on case closure | Case flow service | Remove PII after resolution |

---

## Cross-Cutting Concerns

### 🚨 CRITICAL SECURITY GAPS
| Concern | Status | Risk Level | Required Action |
|---------|--------|------------|-----------------|
| Environment Secrets Management | ❌ MISSING | **CRITICAL** | Implement proper secret injection |
| Input Sanitization | ❌ MISSING | **HIGH** | Add comprehensive input validation |
| SQL Injection Prevention | ❌ MISSING | **HIGH** | Implement parameterized queries |
| Authentication Middleware | ⚠️ PARTIAL | **HIGH** | Complete JWT validation |
| HTTPS Enforcement | ❌ MISSING | **MEDIUM** | Force HTTPS in production |

### 📱 PLATFORM COMPLIANCE GAPS
| Platform | Requirement | Status | Gap |
|----------|-------------|--------|-----|
| Android 12+ | BLUETOOTH_SCAN with neverForLocation | ❌ MISSING | Platform-specific permission handling |
| iOS | Background BLE with State Preservation | ❌ MISSING | App lifecycle management |
| Taiwan NCC | Device certification validation | ❌ MISSING | Regulatory compliance |
| GDPR/Personal Data | Right to be forgotten implementation | ⚠️ PARTIAL | Complete data deletion |

### 🧪 TEST INFRASTRUCTURE GAPS
| Test Type | Required Coverage | Current Status | Gap |
|-----------|------------------|----------------|-----|
| Unit Tests | ≥80% | 55.31% (Backend) | **24.69% shortfall** |
| Integration Tests | Full API coverage | ⚠️ PARTIAL | Missing endpoints |
| Contract Tests | MyData API compliance | ❌ MISSING | External service validation |
| E2E Tests | Console UI workflows | ❌ MISSING | No automation |
| Mobile Tests | BLE/Geofence scenarios | 28.96% | **51.04% shortfall** |

---

## Production Readiness Assessment

### 🚨 BLOCKERS (Must fix before deployment)
1. **BLE Service Test Failures** - Multiple undefined property errors
2. **NCC Certification Missing** - Regulatory compliance requirement
3. **Security Vulnerabilities** - No input sanitization or injection protection
4. **Test Coverage Below Threshold** - <80% requirement not met

### ⚠️ HIGH PRIORITY (Fix within sprint)
1. **Geofence 10m Accuracy** - Core safety requirement
2. **MyData Contract Validation** - Integration reliability
3. **RBAC Column Security** - Data protection
4. **Mobile Platform Compliance** - App store approval

### 📋 MEDIUM PRIORITY (Next iteration)
1. **BDD Feature Files** - Documentation and acceptance criteria
2. **E2E Test Suite** - Console automation
3. **Performance Optimization** - Load testing
4. **Audit Trail Completeness** - Compliance logging

### 🔧 LOW PRIORITY (Technical debt)
1. **Code Documentation** - JSDoc completion
2. **Error Message Localization** - User experience
3. **Monitoring Integration** - Observability
4. **CI/CD Pipeline Enhancement** - Development efficiency

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)
1. Fix BLE scanner test failures (MAC rotation, metrics)
2. Implement NCC certification validation
3. Add input sanitization middleware
4. Resolve geofence accuracy issues

### Phase 2: Security & Compliance (Week 2)
1. Complete authentication middleware
2. Implement MyData contract validation
3. Add RBAC column filtering
4. Enhance audit trail security

### Phase 3: Platform Integration (Week 3)
1. Android 12+ permission flows
2. iOS state preservation
3. Mobile test coverage improvement
4. E2E test framework setup

### Phase 4: Production Hardening (Week 4)
1. Performance testing and optimization
2. Security penetration testing
3. Compliance audit preparation
4. Deployment automation

---

**CONCLUSION**: The system has a solid TDD foundation but requires significant work on security, compliance, and test coverage before production deployment. Priority should be given to fixing failing tests and implementing missing security controls.