Feature: Volunteer Consent Management
  As a volunteer user of the HsinchuPass Guardian system
  I want to manage my consent for background BLE scanning
  So that I can help locate missing persons while protecting my privacy

  Background:
    Given the app is installed and initialized
    And privacy notices are displayed
    And GDPR compliance is enabled

  @consent @privacy
  Scenario: User opts in to volunteer mode
    Given I am on the volunteer tab
    And I have not previously given consent
    When I tap "成為志工協助者"
    And I review the consent terms v2.1
    And I tap "我同意並開始協助"
    Then volunteer mode should be enabled
    And background BLE scanning should start
    And consent timestamp should be recorded
    And consent version "2.1" should be stored
    And volunteer status should show "已啟用背景掃描"

  @consent @privacy
  Scenario: User withdraws consent
    Given I am in volunteer mode
    And background scanning is active
    When I tap "停止志工協助"
    And I confirm "確定停止協助"
    Then volunteer mode should be disabled immediately
    And background BLE scanning should stop
    And all queued data uploads should be cancelled
    And local volunteer data should be purged
    And volunteer status should show "已停用"

  @consent @persistence
  Scenario: App restart preserves consent state
    Given I have given volunteer consent
    And the app is force-closed
    When I restart the app
    Then volunteer mode should remain enabled
    And background scanning should resume automatically
    And consent timestamp should be preserved
    And no re-consent should be required

  @consent @gdpr
  Scenario: Consent timestamp tracking for GDPR compliance
    Given I opt in to volunteer mode at "2025-09-17T16:45:30Z"
    When I check consent metadata
    Then consent timestamp should be "2025-09-17T16:45:30Z"
    And consent version should be "2.1"
    And user ID should be anonymized
    And IP address should not be stored
    And device fingerprint should be minimal

  @consent @versioning
  Scenario: Consent version management for terms updates
    Given I have consent version "2.0"
    And terms are updated to version "2.1"
    When I open the app
    Then I should see "使用條款已更新"
    And background scanning should be paused
    And I should be prompted to review new terms
    When I accept the new terms
    Then consent version should update to "2.1"
    And background scanning should resume

  @consent @permissions
  Scenario: Android 12+ permission handling
    Given I am on Android 12 or higher
    And I opt in to volunteer mode
    When the app requests BLE permissions
    Then BLUETOOTH_SCAN permission should be requested
    And BLUETOOTH_CONNECT permission should be requested
    And ACCESS_FINE_LOCATION should be requested only if location inference is enabled
    And "neverForLocation" flag should be set if no location inference
    And rationale should explain volunteer assistance purpose

  @consent @ios
  Scenario: iOS background BLE permissions
    Given I am on iOS
    And I opt in to volunteer mode
    When the app configures BLE
    Then "bluetooth-central" background mode should be enabled
    And State Preservation should be configured
    And State Restoration should be configured
    And CBCentralManager should be initialized with restore identifier
    And privacy usage description should be shown

  @error-handling
  Scenario: Permission denied graceful handling
    Given I opt in to volunteer mode
    When BLE permission is denied
    Then volunteer mode should remain disabled
    And user should see "需要藍牙權限才能協助定位"
    And "前往設定" button should be displayed
    And no background scanning should start
    And consent should be marked as "pending_permissions"