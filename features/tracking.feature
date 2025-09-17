# Language: zh-TW
@P3 @tracking @progress @notifications
Feature: 進度追蹤與通知管理
  As a family member or volunteer user
  I want to track progress of missing person cases and receive relevant notifications
  So that I stay informed about case developments while respecting privacy boundaries

  Background:
    Given user authentication is valid
    And notification permissions are granted
    And privacy settings are configured
    And case access permissions are verified

  @tracking @case-progress @family-member
  Scenario: Family member tracks their case progress with privacy protection
    Given I am a family member who reported a missing person case
    And my case ID is "CASE-2025-091701"
    And case status is "active_investigation"
    When I access "我的案件進度"
    Then I should see case status "搜尋進行中"
    And I should see last update time "2025-09-17T16:45:00Z"
    And I should see "已有3位志工協助搜尋"
    And I should see search area coverage "涵蓋範圍：中正路周邊500公尺"
    But I should NOT see specific volunteer identities
    And I should NOT see detailed location data
    And I should NOT see other families' case information

  @tracking @volunteer-contribution @anonymized-impact
  Scenario: Volunteer tracks their contribution impact (anonymized)
    Given I am an active volunteer
    And I have been scanning for 7 days
    When I access "我的貢獻紀錄"
    Then I should see "本週掃描時數：42小時"
    And I should see "協助搜尋：3個案件區域"
    And I should see "設備發現數：127次"
    But I should NOT see specific case details
    And I should NOT see location names
    And I should NOT see family member information
    And I should see contribution impact as "您的協助可能幫助了走失者家庭"

  @tracking @case-timeline @progress-milestones
  Scenario: Case timeline with privacy-preserving milestones
    Given a missing person case has been active for 6 hours
    When family member checks case timeline
    Then timeline should show:
      | Time | Milestone | Description |
      | T+0h | 案件建立 | 開始搜尋程序 |
      | T+1h | 志工招募 | 開始志工協助 |
      | T+3h | 範圍擴大 | 搜尋範圍擴展至1公里 |
      | T+6h | 進度更新 | 持續搜尋中，已有線索回報 |
    And sensitive operational details should be excluded
    And timeline should auto-update every 30 minutes
    And family should receive push notifications for major milestones

  @tracking @multi-case-dashboard @volunteer-perspective
  Scenario: Volunteer dashboard showing multiple case areas (anonymized)
    Given I am a volunteer in central Hsinchu area
    And there are 3 active cases within my scanning range
    When I access volunteer dashboard
    Then I should see "目前協助搜尋：3個區域"
    And I should see heat map showing general search priority areas
    And each area should be color-coded by urgency (green/yellow/red)
    But NO case details should be visible
    And NO missing person information should be shown
    And areas should be displayed as generic "搜尋區域A/B/C"
    And I should receive notification when entering high-priority areas

  @tracking @notification-preferences @granular-control
  Scenario: Granular notification preference management
    Given I want to customize my notification experience
    When I access "通知設定"
    Then I should be able to configure:
      | Notification Type | Options | Default |
      | 案件進度更新 | 即時/每小時/每日/關閉 | 每小時 |
      | 志工協助請求 | 即時/關閉 | 即時 |
      | 系統維護通知 | 開啟/關閉 | 開啟 |
      | 安全提醒 | 開啟/關閉 | 開啟 |
      | 成功案例分享 | 開啟/關閉 | 關閉 |
    And settings should apply immediately
    And preferences should be synced across devices

  @tracking @real-time-updates @websocket
  Scenario: Real-time progress updates via WebSocket connection
    Given I am viewing case progress page
    And WebSocket connection is established
    When case status changes on server
    Then page should update automatically without refresh
    And notification badge should increment
    And update animation should be subtle and non-intrusive
    And connection should handle intermittent network issues
    And fallback to polling should occur if WebSocket fails
    And battery impact should be minimized on mobile devices

  @tracking @privacy-boundaries @information-filtering
  Scenario: Strict privacy boundaries in progress information
    Given I am family member of Case A
    And another family has Case B in same area
    When I view progress information
    Then I should ONLY see information about my case
    And aggregated volunteer statistics may be shown (anonymized)
    And general search area coverage may be visible
    But NO information about other cases should be accessible
    And NO cross-case correlation should be possible
    And system should actively prevent information leakage

  @tracking @volunteer-safety @location-tracking-consent
  Scenario: Volunteer safety tracking with explicit consent
    Given I am a volunteer in active search area
    And I opt-in to safety tracking with "同意安全位置追蹤"
    When I am in high-risk search zone
    Then my approximate location should be monitored for safety
    And safety check notifications should be sent every 30 minutes
    And emergency contact should be triggered if I don't respond within 1 hour
    And safety tracking should be clearly distinguished from case tracking
    And I should be able to disable safety tracking anytime
    And safety data should be deleted after 24 hours

  @tracking @case-resolution @outcome-notification
  Scenario: Case resolution notification and outcome tracking
    Given I am involved in a missing person case (as family or volunteer)
    When case status changes to "resolved_found" or "resolved_safe"
    Then I should receive immediate notification "好消息！走失者已安全找到"
    And case should be marked as resolved in my dashboard
    And final outcome statistics should be shared (if family consents)
    And volunteer contribution acknowledgment should be sent
    And follow-up surveys may be requested for service improvement
    But specific resolution details should remain confidential

  @tracking @escalation-alerts @priority-changes
  Scenario: Case escalation and priority change notifications
    Given I am a volunteer in area with standard priority case
    When case priority escalates to "high" due to safety concerns
    Then I should receive priority notification "案件優先級提升，請加強協助"
    And scanning frequency recommendations should be updated
    And additional safety guidelines should be provided
    And opt-out option should remain available
    And escalation reason should be general (no sensitive details)

  @tracking @progress-analytics @family-insights
  Scenario: Progress analytics and insights for family members
    Given my case has been active for 48 hours
    When I view "進度分析"
    Then I should see search effectiveness metrics:
      | Metric | Value | Explanation |
      | 搜尋覆蓋率 | 85% | 目標區域內已搜尋比例 |
      | 志工參與度 | 高 | 志工響應積極 |
      | 線索回報數 | 3條 | 民眾提供的有效線索 |
      | 系統匹配率 | 12% | BLE掃描發現可能匹配 |
    And insights should help manage family expectations
    And analytics should be updated every 4 hours

  @tracking @volunteer-motivation @gamification-elements
  Scenario: Volunteer motivation through progress recognition (privacy-safe)
    Given I have been volunteering for 30 days
    When I check my volunteer profile
    Then I should see achievement badges:
      | Badge | Criteria | Privacy Level |
      | 搜尋新手 | 7天連續掃描 | Safe |
      | 區域守護者 | 30天活躍於同區域 | Safe |
      | 案件協助者 | 參與5個案件搜尋 | Anonymized |
      | 社區英雄 | 100小時志工服務 | Safe |
    And monthly volunteer newsletter may highlight anonymous success stories
    And recognition should NOT compromise case privacy
    And opt-out from gamification should be available

  @error-handling @tracking-system-failures
  Scenario: Handling tracking system failures and user communication
    Given tracking system experiences technical difficulties
    When progress updates fail to load
    Then user should see "系統暫時無法更新，請稍後再試"
    And cached/last known information should be displayed
    And system status page should be accessible
    And estimated repair time should be communicated
    And critical notifications should still function via backup channels
    And user should be able to contact support for urgent case updates

  @accessibility @tracking-interface @inclusive-design
  Scenario: Accessible progress tracking for users with disabilities
    Given user has visual impairments and uses screen reader
    When accessing progress tracking interface
    Then all progress information should be screen reader compatible
    And progress updates should be announced clearly
    And visual progress indicators should have text alternatives
    And voice commands should be supported for navigation
    And high contrast mode should be available
    And font sizes should be adjustable
    And progress information should be available via audio summaries

  @monitoring @tracking-metrics @system-health
  Scenario: System monitoring of tracking feature performance
    Given tracking system is operational
    When system health monitoring runs
    Then metrics should include: update delivery success rate, WebSocket connection stability, notification delivery rate
    And user engagement with tracking features should be measured
    And performance benchmarks should be maintained (updates <5 seconds)
    And error rates should be monitored and alerted
    And capacity planning should account for peak case loads
    And user satisfaction with tracking information should be surveyed quarterly