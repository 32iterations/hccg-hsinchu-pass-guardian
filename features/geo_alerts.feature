Feature: Geographic Alert Notifications
  As a volunteer user in the vicinity of a missing person case
  I want to receive appropriate alerts with safety instructions
  So that I can be aware of the situation while maintaining safety protocols

  Background:
    Given volunteer consent is granted
    And push notification permissions are approved
    And location services are enabled
    And alert preferences are configured

  @geo-alerts @radius @targeting
  Scenario: Alert radius configurations
    Given a missing person case is active at lat=24.8067, lng=120.9687
    And I am 400m away from the incident location
    When a 500m radius alert is triggered
    Then I should receive the alert notification
    And alert should show "500公尺範圍內協助提醒"
    And notification priority should be "high"

  @geo-alerts @radius @targeting
  Scenario: Outside alert radius
    Given a missing person case is active at lat=24.8067, lng=120.9687
    And I am 1.2km away from the incident location
    When a 1km radius alert is triggered
    Then I should NOT receive the alert
    And no notification should be displayed
    And battery should not be consumed for irrelevant alerts

  @geo-alerts @cooldown @spam-prevention
  Scenario: Alert cooldown prevents spam
    Given I received an alert at "2025-09-17T16:45:00Z"
    And the same case generates another alert at "2025-09-17T16:47:00Z"
    When the second alert is triggered
    Then I should NOT receive the duplicate alert
    And cooldown timer should show "3分鐘後可再次接收"
    When time reaches "2025-09-17T16:50:01Z"
    Then cooldown should be reset
    And new alerts should be allowed

  @geo-alerts @privacy @no-pii
  Scenario: Alert content contains NO personal information
    Given a missing person case involves "王小明, 65歲男性"
    When I receive a geo alert
    Then alert message should be "安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。"
    And NO name should be included
    And NO age should be specified
    And NO gender should be mentioned
    And NO photo should be attached
    And NO personal details should be revealed

  @geo-alerts @priority @info
  Scenario: Info level priority alert
    Given a non-urgent missing person case
    When info level alert is sent
    Then notification sound should be standard
    And notification should not override Do Not Disturb
    And alert should appear in notification shade
    And message should include "一般提醒"
    And color indicator should be blue

  @geo-alerts @priority @warning
  Scenario: Warning level priority alert
    Given a moderate risk missing person case
    When warning level alert is sent
    Then notification sound should be prominent
    And notification should use Time-Sensitive delivery (iOS)
    And notification channel should be high importance (Android)
    And alert should include "重要提醒"
    And color indicator should be orange

  @geo-alerts @priority @critical
  Scenario: Critical level priority alert
    Given a high-risk missing person case with safety concerns
    When critical level alert is sent
    Then notification should use Critical Alert (iOS) if authorized
    And Full-Screen Intent should be used (Android) with user consent
    And alert should include "緊急提醒"
    And color indicator should be red
    And user should be able to dismiss or snooze

  @geo-alerts @safety @mandatory-message
  Scenario: Mandatory safety instructions in all alerts
    Given any level of geo alert
    When alert is displayed
    Then message MUST include "請撥打110"
    And message MUST include "切勿自行接近"
    And emergency contact button should be visible
    And "回報可疑" button should be available
    And safety guidelines link should be provided

  @geo-alerts @ab-testing @safety-messages
  Scenario: A/B test variations for safety message effectiveness
    Given I am in A/B test group "safety_message_variant_B"
    When I receive a geo alert
    Then message should use variant B wording
    And engagement metrics should be tracked
    And user response should be recorded for analysis
    But core safety instructions must remain unchanged
    And "撥打110" and "切勿接近" must always be present

  @geo-alerts @localization @traditional-chinese
  Scenario: Traditional Chinese localization
    Given device language is Traditional Chinese
    When I receive any geo alert
    Then all text should be in Traditional Chinese
    And emergency number should be "110" (Taiwan)
    And cultural context should be appropriate
    And font rendering should support CJK characters
    And text direction should be left-to-right

  @geo-alerts @accessibility @screen-reader
  Scenario: Screen reader accessibility
    Given user has VoiceOver enabled (iOS) or TalkBack (Android)
    When geo alert is received
    Then alert content should be announced by screen reader
    And button labels should be descriptive
    And semantic markup should be correct
    And reading order should be logical
    And emergency actions should be easily accessible

  @geo-alerts @network @offline-handling
  Scenario: Network connectivity during alert delivery
    Given device has intermittent network connectivity
    When geo alert is triggered from server
    Then alert should be delivered when connectivity returns
    And alert should not expire due to network delays
    And local cache should store recent alerts
    And retry mechanism should handle delivery failures

  @geo-alerts @battery @optimization
  Scenario: Battery-efficient alert processing
    Given multiple geo alerts are queued
    And device battery is below 20%
    When alert processing occurs
    Then location checks should be batched
    And unnecessary background processing should be minimized
    And alert delivery should be prioritized over non-critical operations
    And power-saving mode should be respected

  @error-handling @location-denied
  Scenario: Location permission denied for geo alerts
    Given geo alerts are configured
    When location permission is denied
    Then user should see "需要位置權限接收區域提醒"
    And option to enable location should be provided
    And alerts should fall back to general notifications
    And volunteer mode should remain functional

  @error-handling @notification-disabled
  Scenario: Push notifications disabled
    Given geo alerts are enabled
    When push notification permission is disabled
    Then user should see "請啟用通知以接收重要提醒"
    And settings deep link should be provided
    And in-app alert banner should be shown as fallback
    And critical alerts should still attempt delivery