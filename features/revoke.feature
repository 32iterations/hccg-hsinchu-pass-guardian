# Language: zh-TW
@P3 @revoke @gdpr @taiwan-pdpa
Feature: 同意撤回與資料移除流程
  As a volunteer or family member user
  I want to revoke my consent and have my data removed
  So that I can exercise my privacy rights under GDPR and Taiwan PDPA

  Background:
    Given user authentication is valid
    And consent records exist in the system
    And GDPR compliance framework is active
    And Taiwan PDPA regulations are configured

  @revoke @volunteer-consent @immediate-effect
  Scenario: Volunteer revokes consent with immediate data processing halt
    Given I am a volunteer with active consent
    And background BLE scanning is operational
    And I have VolunteerHit data from the past 30 days
    When I select "撤回志工同意"
    And I confirm "確定撤回所有同意並刪除資料"
    Then background BLE scanning should stop immediately
    And new VolunteerHit creation should be blocked
    And data upload queues should be purged
    And my volunteer status should change to "已撤回"
    And revocation timestamp should be recorded as "2025-09-17T16:45:00Z"
    And I should see "同意已撤回，資料將在30天內完全刪除"

  @revoke @family-member @care-relationship
  Scenario: Family member revokes consent for care recipient monitoring
    Given I am a family member with active consent for monitoring my care recipient
    And care recipient device binding exists
    And geofence alerts are configured
    When I select "撤回照護監控同意"
    And I confirm the revocation
    Then device binding should be immediately deactivated
    And geofence monitoring should stop for my care recipient
    And future location alerts should be disabled
    And care relationship should be marked as "revoked"
    And care recipient should be notified of monitoring cessation
    And I should receive confirmation "照護監控已停止，相關資料將被刪除"

  @revoke @partial-consent @granular-control
  Scenario: Partial consent revocation with granular data control
    Given I have multiple active consents: volunteer mode, geofence alerts, data analytics
    When I access "管理我的同意設定"
    And I revoke only "資料分析使用同意"
    But maintain "志工模式" and "地理圍籬通知"
    Then analytics data processing should stop immediately
    And volunteer BLE scanning should continue
    And geofence alerts should remain active
    And partial revocation should be logged with specific consent ID
    And affected data streams should be identified and isolated

  @revoke @data-processing-halt @system-wide
  Scenario: System-wide data processing halt upon revocation
    Given my data is being processed across multiple system components
    And I revoke consent
    When revocation is processed
    Then real-time data processing should halt within 5 minutes
    And batch processing jobs should exclude my data from next run
    And machine learning models should mark my data for exclusion
    And analytics pipelines should filter out my data
    And third-party data sharing should be immediately suspended
    And data processors should be notified of revocation within 1 hour

  @revoke @thirty-day-deletion @gdpr-timeline
  Scenario: Complete data deletion within 30-day GDPR timeline
    Given I revoked consent on "2025-09-17T16:45:00Z"
    When 30 days have elapsed
    Then all my personal data should be completely deleted
    And anonymized statistical data may remain (if legally compliant)
    And deletion should be verified across: primary database, backups, logs, caches, analytics stores
    And deletion certificate should be generated
    And I should receive confirmation "您的個人資料已完全刪除"
    And only revocation audit record should remain (for legal protection)

  @revoke @backup-systems @comprehensive-deletion
  Scenario: Revocation affects backup and archive systems
    Given my data exists in: production database, daily backups, weekly archives, disaster recovery systems
    When I revoke consent
    Then deletion process should include all backup systems
    And backup restoration should exclude my data
    And archive systems should be purged within 30 days
    And disaster recovery systems should be updated
    And cross-geographic backups should be synchronized for deletion
    And backup verification should confirm complete removal

  @revoke @legal-basis-data @retention-exception
  Scenario: Legal basis data retention after consent revocation
    Given I revoke consent
    And some data has legal basis beyond consent (e.g., safety incident reports)
    When deletion process executes
    Then consent-based data should be deleted immediately
    And legal basis data should be reviewed for necessity
    And legal basis data should be anonymized where possible
    And specific legal justification should be documented
    And legal basis data retention should have defined expiration
    And I should be informed which data remains and why

  @revoke @third-party-processors @data-sharing-cessation
  Scenario: Third-party data processor notification and cessation
    Given my data has been shared with authorized third-party processors
    When I revoke consent
    Then all third-party processors should be notified within 4 hours
    And data processing agreements should be invoked for deletion
    And third-party deletion should be requested immediately
    And deletion confirmation should be obtained from all processors
    And my data should be blocked from future third-party sharing
    And processor notification audit trail should be maintained

  @revoke @anonymization-verification @k-anonymity
  Scenario: Anonymization verification after revocation
    Given my data has been anonymized for statistical purposes
    When I revoke consent
    Then anonymized datasets should be reviewed for potential re-identification
    And k-anonymity should be verified (k>=3)
    And if re-identification risk exists, data should be further anonymized or deleted
    And anonymization techniques should be documented
    And third-party anonymization review should be conducted
    And anonymization certificate should be provided

  @revoke @emergency-situations @safety-override
  Scenario: Revocation during active emergency situations
    Given I am a volunteer currently assisting in an active missing person case
    And my BLE data is contributing to ongoing search efforts
    When I attempt to revoke consent
    Then I should see warning "目前有進行中的緊急案件，撤回可能影響搜救"
    And emergency override option should be presented to case managers
    And I should have option to "立即撤回" or "案件結束後撤回"
    If I choose immediate revocation
    Then my data contribution should stop immediately despite emergency
    And case managers should be notified of volunteer withdrawal
    And search algorithms should adapt to reduced data availability

  @revoke @cross-border-processing @international-deletion
  Scenario: Cross-border data processing revocation compliance
    Given my data is processed in multiple jurisdictions
    When I revoke consent under Taiwan PDPA
    Then Taiwan data should be deleted within Taiwan PDPA timeline
    And EU data should be deleted within GDPR timeline (30 days)
    And US data should be deleted per applicable state privacy laws
    And jurisdiction-specific legal requirements should be followed
    And deletion coordination should ensure no data remnants
    And international deletion verification should be obtained

  @revoke @technical-challenges @system-limitations
  Scenario: Technical challenges in complete data removal
    Given data exists in immutable logs, blockchain records, or ML model weights
    When I revoke consent
    Then technically deletable data should be removed immediately
    And technically challenging data should be assessed case-by-case
    And legal evaluation should determine handling of immutable data
    And compensating controls should be implemented (access restrictions, encryption key destruction)
    And technical limitations should be transparently communicated
    And alternative privacy protections should be offered

  @error-handling @revocation-failures
  Scenario: Handling revocation process failures
    Given revocation process encounters system errors
    When automated deletion fails
    Then manual intervention should be triggered immediately
    And privacy team should be alerted within 1 hour
    And user should be notified of delay with explanation
    And temporary access restrictions should be applied to my data
    And manual deletion should be completed within 72 hours
    And process failure should be investigated and documented
    When manual deletion completes
    Then user should receive confirmation and apology
    And system should be updated to prevent similar failures

  @monitoring @revocation-metrics @compliance-tracking
  Scenario: Revocation process monitoring and compliance metrics
    Given revocation requests are processed regularly
    When compliance reporting is generated
    Then metrics should include: total revocations, average processing time, deletion success rate, system failures
    And revocation trends should be analyzed monthly
    And compliance deadlines should be tracked and monitored
    And escalation alerts should trigger for delayed deletions
    And regulatory reporting should include revocation statistics
    And user satisfaction with revocation process should be measured