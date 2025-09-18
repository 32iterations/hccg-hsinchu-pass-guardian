# Product Vision & Requirements

## Product Overview
**Name**: HCCG Hsinchu Pass Guardian (新竹市政府安心守護系統)
**Version**: 2.0.0
**Category**: Healthcare Safety Platform

## Problem Statement
Dementia patients in Hsinchu City require a comprehensive safety monitoring system that balances effective tracking with privacy protection, enabling rapid response when patients wander while respecting their dignity and autonomy.

## Target Users

### Primary Users
1. **Family Members (家屬)**
   - Care for dementia patients
   - Need real-time location updates
   - Manage device bindings and geofences
   - Receive smart notifications

2. **Volunteer Searchers (志工)**
   - Assist in locating missing patients
   - Use BLE scanning for proximity detection
   - Maintain patient privacy (anonymized data)
   - Coordinate search efforts

3. **Healthcare Administrators (管理者)**
   - Monitor system-wide operations
   - Generate compliance reports
   - Manage user access and permissions
   - Track KPIs and system health

### Secondary Users
- Emergency responders
- Healthcare providers
- Social workers
- Government officials

## Core Features

### P1: Family MVP
- **Device Binding**: NCC-certified device registration with duplicate prevention
- **Geofence Engine**: Smart boundary monitoring with cooldown logic
- **BLE Resilience**: Auto-retry and background reconnection
- **Smart Notifications**: Time-sensitive alerts (iOS) / high-priority (Android)

### P2: Volunteer System
- **BLE Scanner**: Background scanning with anonymization
- **K-Anonymity**: Privacy protection (k≥3)
- **Mobile Geofence**: Dynamic boundary management
- **Proximity Alerts**: Distance-based notifications

### P3: MyData Integration
- **Privacy Compliance**: TTL and revocation mechanisms
- **Data Portability**: Standard API integration
- **Consent Management**: Granular permission control
- **Audit Trail**: Complete data access logging

### P4: Admin Console
- **RBAC**: Multi-tier access control
- **Case Management**: Workflow automation
- **KPI Dashboard**: Real-time metrics
- **Audit System**: Comprehensive logging

## Success Metrics
- **Response Time**: < 15 minutes for missing patient alerts
- **System Uptime**: 99.9% availability
- **Privacy Compliance**: 100% GDPR/MyData adherent
- **User Adoption**: 80% active family engagement
- **Search Success**: > 90% patient recovery rate

## Constraints
- Taiwan NCC device certification required
- Battery optimization for 24+ hour tracking
- Network resilience for rural areas
- Multi-language support (Traditional Chinese primary)

## Future Roadmap
- AI-powered predictive analytics
- Integration with healthcare systems
- Expansion to other cities
- Wearable device partnerships