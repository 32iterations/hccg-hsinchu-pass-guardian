# Language: zh-TW
@P3 @retention @gdpr @taiwan-pdpa
Feature: 回執保存與資料生命週期管理
  As a system administrator managing data retention
  I want to enforce proper data lifecycle and retention policies
  So that we comply with GDPR, Taiwan PDPA, and minimize data exposure

  Background:
    Given the retention service is initialized
    And GDPR compliance mode is enabled
    And Taiwan PDPA regulations are configured
    And data classification policies are loaded

  @retention @consent-data @ttl
  Scenario: Volunteer consent data retention with TTL
    Given a volunteer provides consent at "2025-09-17T16:45:00Z"
    And consent retention policy is set to 3 years
    When the consent record is created
    Then TTL should be set to "2028-09-17T16:45:00Z"
    And retention status should be "active"
    And data classification should be "personal_consent"
    And automatic purge job should be scheduled
    When TTL expires at "2028-09-17T16:45:01Z"
    Then consent record should be automatically purged
    And all related volunteer data should be removed
    And audit log should record "consent_data_purged"

  @retention @volunteer-hits @minimal-storage
  Scenario: VolunteerHit data minimal retention
    Given a VolunteerHit is created with anonymized data
    And hit retention policy is set to 30 days
    When the VolunteerHit is stored
    Then TTL should be set to 30 days from creation
    And data should be marked as "anonymized_telemetry"
    And no personal identifiers should be stored
    When 30 days elapse
    Then VolunteerHit should be automatically purged
    And no manual intervention should be required
    And storage space should be reclaimed

  @retention @case-data @investigation-period
  Scenario: Missing person case data retention during active investigation
    Given a missing person case is created
    And case is marked as "active_investigation"
    When case retention policy is applied
    Then base retention should be 1 year
    And TTL should be extendable during active investigation
    And sensitive personal data should have shorter TTL (90 days)
    And location data should have minimal TTL (7 days)
    When case is marked as "resolved"
    Then retention clock should start countdown
    And case data should be progressively purged (location first, then personal details, finally case metadata)

  @retention @logs @audit-trail
  Scenario: System logs and audit trail retention
    Given system generates operational logs
    And audit events are recorded
    When log retention policies are applied
    Then security logs should be retained for 2 years
    And operational logs should be retained for 6 months
    And debug logs should be retained for 30 days
    And personal data in logs should be automatically redacted after 24 hours
    And log rotation should occur daily
    And compressed archives should be created for long-term storage

  @retention @gdpr-right-to-be-forgotten @immediate-purge
  Scenario: GDPR Article 17 Right to Erasure (Right to be Forgotten)
    Given a volunteer has active consent and data
    And volunteer invokes right to be forgotten
    When erasure request is processed
    Then all personal data should be identified across systems
    And consent records should be marked for immediate deletion
    And volunteer hits should be purged within 72 hours
    And backup systems should be updated within 30 days
    And confirmation of erasure should be provided to user
    And audit log should record complete erasure process
    But legal basis data required for compliance should be retained (anonymized case numbers for statistics only)

  @retention @taiwan-pdpa @data-minimization
  Scenario: Taiwan Personal Data Protection Act compliance
    Given Taiwan PDPA requirements are active
    When any personal data is collected
    Then specific purpose must be defined and recorded
    And retention period must not exceed necessity for purpose
    And data subject must be informed of retention period
    And data must be securely destroyed when retention expires
    When purpose is fulfilled earlier than planned retention
    Then data should be purged immediately regardless of TTL
    And destruction certificate should be generated

  @retention @progressive-purge @data-aging
  Scenario: Progressive data purging based on sensitivity
    Given a complete missing person case with various data types
    When case enters retention phase
    Then immediate purge (T+0): Real-time location data, device identifiers
    And 7 days (T+7): Precise GPS coordinates, MAC addresses
    And 30 days (T+30): Photos, personal descriptions, family contact details
    And 90 days (T+90): Full personal information, witness statements
    And 1 year (T+365): Case metadata, outcome summary (anonymized)
    And 3 years (T+1095): All remaining data except statistical aggregates
    And each purge stage should be logged and verified

  @retention @backup-lifecycle @disaster-recovery
  Scenario: Backup data lifecycle and retention
    Given production data has retention policies
    And backup systems replicate this data
    When backups are created
    Then backup retention should not exceed production data retention
    And backup data should inherit TTL from source
    And backup purging should be coordinated with production purges
    When disaster recovery is invoked
    Then restored data should maintain original TTL values
    And restoration should not extend data lifetime beyond policy
    And compliance obligations should be preserved during recovery

  @retention @cross-border @data-residency
  Scenario: Cross-border data retention with Taiwan residency requirements
    Given volunteer data crosses Taiwan borders for processing
    When data is stored internationally
    Then Taiwan copy must be maintained as primary
    And international copies must have shorter or equal TTL
    And purging must occur in Taiwan first, then internationally
    And data sovereignty requirements must be respected
    When Taiwan PDPA requires immediate deletion
    Then all international copies must be purged within 72 hours
    And deletion verification must be obtained from all jurisdictions

  @retention @encryption-key-rotation @security
  Scenario: Encryption key lifecycle tied to data retention
    Given encrypted personal data is stored
    And encryption keys have lifecycle policies
    When data reaches 80% of retention period
    Then encryption keys should be rotated
    And old keys should be securely archived
    When data TTL expires
    Then associated encryption keys should be permanently destroyed
    And key destruction should make data unrecoverable
    And key destruction audit should be recorded

  @retention @consent-withdrawal @immediate-effect
  Scenario: Consent withdrawal triggers immediate retention policy override
    Given a volunteer has active consent with 3-year retention
    And volunteer data is stored across multiple systems
    When volunteer withdraws consent
    Then normal retention TTL should be overridden immediately
    And all personal data should be marked for immediate purge
    And purge should complete within 30 days maximum
    And only anonymized statistical data should remain
    And withdrawal timestamp should be permanently recorded (for legal protection)

  @error-handling @retention-failures
  Scenario: Handling retention policy enforcement failures
    Given automatic purge job encounters system errors
    When TTL expiration cannot be processed automatically
    Then failed purges should be queued for retry
    And manual intervention alerts should be triggered
    And compliance team should be notified within 4 hours
    And temporary retention extension should be logged as exception
    When manual purge is completed
    Then exception should be closed and logged
    And retention metrics should be updated

  @monitoring @retention-metrics @compliance-reporting
  Scenario: Retention metrics and compliance reporting
    Given retention policies are actively enforced
    When compliance reporting is generated
    Then metrics should include: total records under retention, TTL distribution, purge success rate, policy violations
    And reports should be generated monthly for internal review
    And quarterly reports should be prepared for regulatory compliance
    And retention dashboard should show real-time TTL status
    And alerts should trigger for data approaching retention limits
    And exception reports should highlight policy violations or system failures