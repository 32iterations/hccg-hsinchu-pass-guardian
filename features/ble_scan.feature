Feature: BLE Scanning with Privacy
  As a volunteer user
  I want to scan for BLE devices while preserving privacy
  So that I can help locate missing persons without compromising anyone's personal data

  Background:
    Given volunteer consent is granted
    And BLE permissions are approved
    And anonymization service is configured
    And battery optimization is disabled for the app

  @ble @privacy @android
  Scenario: Android 12+ neverForLocation scanning
    Given I am on Android 12 or higher
    And neverForLocation preference is enabled
    When BLE scanning starts
    Then BLUETOOTH_SCAN permission should be used
    And ACCESS_FINE_LOCATION should NOT be requested
    And scanning should discover BLE devices
    And MAC addresses should be anonymized immediately
    And no location inference should occur
    And device hashes should be generated with salt

  @ble @privacy @android
  Scenario: Android location-based scanning for positioning
    Given I am on Android 12 or higher
    And location inference is enabled for better accuracy
    When BLE scanning starts with location
    Then BLUETOOTH_SCAN permission should be used
    And ACCESS_FINE_LOCATION should be granted
    And ACCESS_BACKGROUND_LOCATION should be requested
    And scanning should include RSSI and location data
    And location should be fuzzed to 100m grid squares
    And timestamp should be rounded to 5-minute intervals

  @ble @ios @background
  Scenario: iOS State Preservation after app termination
    Given I am on iOS
    And the app is running in background
    When iOS terminates the app due to memory pressure
    Then BLE scanning state should be preserved
    And CBCentralManager restore identifier should be saved
    When the app is restored by BLE events
    Then scanning should resume automatically
    And previous scan configuration should be restored
    And volunteer hits should continue being recorded

  @ble @ios @background
  Scenario: iOS State Restoration on app launch
    Given the app was terminated while BLE scanning
    And iOS preserved the BLE state
    When the app launches
    Then CBCentralManager should restore with identifier
    And scanning state should be recovered
    And background scanning should resume
    And no user intervention should be required

  @ble @discovery @filtering
  Scenario: Device discovery with RSSI filtering
    Given BLE scanning is active
    When a BLE device is discovered
    And RSSI is stronger than -90 dBm
    Then device should be processed for VolunteerHit
    And MAC address should be hashed immediately
    And original MAC should never be stored
    And RSSI value should be recorded
    And timestamp should be rounded to 5-minute intervals

  @ble @discovery @filtering
  Scenario: Weak signal device filtering
    Given BLE scanning is active
    When a BLE device is discovered
    And RSSI is weaker than -90 dBm
    Then device should be ignored
    And no VolunteerHit should be created
    And no data should be stored or transmitted
    And battery usage should be minimized

  @ble @privacy @anonymization
  Scenario: MAC address rotation handling
    Given a device with MAC rotation enabled
    When the device rotates its MAC address
    And new MAC "AA:BB:CC:DD:EE:F1" is detected
    And old MAC "AA:BB:CC:DD:EE:F0" was seen 10 minutes ago
    Then each MAC should generate separate hashes
    And no correlation between rotated MACs should be stored
    And temporal clustering should respect privacy
    And k-anonymity should be maintained across rotations

  @ble @performance @battery
  Scenario: Battery-efficient scanning intervals
    Given volunteer mode is active
    And device is not charging
    When BLE scanning operates
    Then scan interval should be 10 seconds ON, 50 seconds OFF
    And scan window should be 5 seconds
    And power level should be POWER_ULTRA_LOW
    And duty cycle should be maximum 20%
    And adaptive intervals should respond to detection rate

  @ble @performance @battery
  Scenario: Aggressive scanning when charging
    Given volunteer mode is active
    And device is charging
    When BLE scanning operates
    Then scan interval should be 5 seconds ON, 5 seconds OFF
    And scan window should be 3 seconds
    And power level should be POWER_HIGH
    And duty cycle can be up to 60%
    And more frequent uploads should be allowed

  @ble @volunteer-hit @anonymization
  Scenario: VolunteerHit creation with complete anonymization
    Given a BLE device is discovered
    And RSSI is -75 dBm
    And current time is "2025-09-17T16:47:32Z"
    And current location is lat=24.8067834, lng=120.9687456
    When VolunteerHit is created
    Then anonymous ID should be UUID v4
    And timestamp should be "2025-09-17T16:45:00Z" (rounded to 5 min)
    And grid square should be "24.8067,120.9687" (100m precision)
    And device hash should be SHA-256 with salt
    And RSSI should be -75
    And NO personal identifiers should be included
    And NO device name should be stored
    And NO original MAC address should be stored

  @ble @k-anonymity @privacy
  Scenario: K-anonymity enforcement for device clusters
    Given multiple devices are detected in same grid square
    When fewer than 3 devices are in cluster
    Then VolunteerHits should be queued but not uploaded
    And cluster should wait for k=3 minimum
    When 3 or more devices form a cluster
    Then all queued hits in cluster should be uploaded together
    And individual device identification should be impossible

  @error-handling @ble
  Scenario: BLE adapter disabled during scanning
    Given BLE scanning is active
    When user disables Bluetooth adapter
    Then scanning should pause gracefully
    And volunteer mode should remain enabled
    And user should see "藍牙已關閉，掃描暫停"
    When Bluetooth is re-enabled
    Then scanning should resume automatically
    And no data loss should occur

  @error-handling @permissions
  Scenario: Permission revoked during operation
    Given BLE scanning is active
    When user revokes BLE permissions
    Then scanning should stop immediately
    And queued data should be preserved
    And user should see "權限被撤銷，請重新授權"
    And volunteer mode should remain in consent state
    When permissions are re-granted
    Then scanning should resume from last state