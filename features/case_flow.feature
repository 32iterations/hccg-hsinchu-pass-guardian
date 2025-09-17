# Language: zh-TW
@P4 @case-flow @workflow @case-management
Feature: 案件流程管理系統
  As a case manager
  I want to manage the complete lifecycle of missing person cases
  So that search operations are coordinated effectively and efficiently

  Background:
    Given case management system is initialized
    And workflow engine is operational
    And notification system is configured
    And role-based access control is active

  @case-flow @case-creation @initial-response
  Scenario: Missing person case creation and initial workflow
    Given I am a case manager receiving a missing person report
    When I create a new case with details:
      | Field | Value | Validation |
      | 走失者姓名 | 王小明 | Required, Chinese name |
      | 年齡 | 65 | Required, numeric |
      | 最後見到時間 | 2025-09-17T14:30:00Z | Required, recent timestamp |
      | 最後見到地點 | 新竹市中正路123號 | Required, valid address |
      | 緊急聯絡人 | 王太太 (女兒) | Required, relationship |
      | 聯絡電話 | 0912345678 | Required, valid mobile |
      | 特殊醫療需求 | 糖尿病患者需定時用藥 | Optional, health info |
    Then case should be assigned unique ID "CASE-2025-091701"
    And case status should be set to "initial_assessment"
    And automatic workflows should be triggered:
      | Workflow Step | Timeline | Responsible |
      | 風險評估 | 立即 | System + Case Manager |
      | 搜尋範圍規劃 | 15分鐘內 | Case Manager |
      | 志工招募啟動 | 30分鐘內 | System |
      | 家屬聯絡確認 | 1小時內 | Case Manager |

  @case-flow @risk-assessment @priority-classification
  Scenario: Automated risk assessment and priority classification
    Given a new case is created with missing person details
    When risk assessment algorithm runs
    Then system should evaluate risk factors:
      | Risk Factor | Weight | Assessment |
      | 年齡 (65歲以上) | High | 高風險群體 |
      | 醫療需求 (糖尿病) | Medium | 需定時用藥 |
      | 失蹤時長 (4小時) | Medium | 黃金搜救時間內 |
      | 天氣狀況 (陰雨) | Low | 輕微影響 |
      | 地形複雜度 (市區) | Low | 相對安全環境 |
    And case priority should be calculated as "Medium-High"
    And search radius should be set to 1.5km initially
    And volunteer recruitment should target 50+ volunteers
    And estimated case duration should be 12-24 hours

  @case-flow @search-area-management @dynamic-expansion
  Scenario: Dynamic search area management based on case progress
    Given case has been active for 2 hours
    And initial 500m radius search yields no results
    And 30 volunteers are actively scanning
    When search area expansion is triggered
    Then search radius should expand to 1km
    And additional volunteer recruitment should be initiated
    And geofence alerts should be updated for new area
    And family should be notified "搜尋範圍已擴大至1公里"
    And search efficiency metrics should be recalculated
    When 4 hours elapse with no significant leads
    Then radius should expand to 2km
    And inter-agency coordination should be considered
    And escalation to emergency services should be evaluated

  @case-flow @volunteer-coordination @resource-allocation
  Scenario: Volunteer coordination and resource allocation
    Given a case requires volunteer assistance
    And 85 volunteers are available in the search area
    When volunteer recruitment is activated
    Then system should:
      | Action | Criteria | Target |
      | 發送搜尋請求 | 3km範圍內志工 | 50位志工 |
      | 優先通知 | 歷史活躍志工 | 響應率提升20% |
      | 區域分配 | 平均分布覆蓋 | 每100m²至少1位 |
      | 輪班安排 | 避免志工疲勞 | 最長4小時輪班 |
      | 即時協調 | 動態重新分配 | 依搜尋進度調整 |
    And volunteer responses should be tracked in real-time
    And search coverage heatmap should be updated continuously
    And volunteer safety should be monitored throughout

  @case-flow @family-communication @progress-updates
  Scenario: Structured family communication and progress updates
    Given family members are registered for case communications
    When case progress milestones are reached
    Then automated updates should be sent:
      | Milestone | Timeline | Message Template |
      | 案件建立 | T+0 | 我們已開始搜尋您的家人 |
      | 志工招募完成 | T+30min | 已有XX位志工加入搜尋 |
      | 搜尋範圍擴大 | T+2hr | 搜尋範圍已擴展以增加覆蓋 |
      | 線索發現 | 即時 | 發現可能線索，正在追蹤 |
      | 每4小時進度 | 定期 | 搜尋持續進行中，志工積極協助 |
    And family should be able to request additional updates
    And case manager should provide personal communication as needed
    And sensitive operational details should be filtered from family updates

  @case-flow @inter-agency @escalation-procedures
  Scenario: Inter-agency coordination and escalation procedures
    Given case has been active for 6 hours without resolution
    And all volunteer resources have been maximized
    When escalation criteria are met
    Then system should initiate inter-agency coordination:
      | Agency | Trigger Condition | Coordination Level |
      | 警察局 | 案件超過6小時 | 正式報案協助 |
      | 消防局 | 有安全風險 | 搜救資源支援 |
      | 社會局 | 涉及高風險族群 | 社工專業協助 |
      | 醫療單位 | 有急迫醫療需求 | 醫療緊急準備 |
    And formal handover procedures should be followed
    And volunteer efforts should continue to complement official search
    And family should be informed of escalation and what to expect

  @case-flow @case-resolution @closure-procedures
  Scenario: Case resolution and closure procedures
    Given missing person has been found safe
    When case resolution is confirmed
    Then closure procedures should be initiated:
      | Step | Timeline | Responsible |
      | 停止搜尋活動 | 立即 | Case Manager |
      | 通知所有志工 | 5分鐘內 | System |
      | 感謝志工貢獻 | 15分鐘內 | System |
      | 家屬確認安全 | 30分鐘內 | Case Manager |
      | 案件報告產生 | 2小時內 | Case Manager |
      | 資料歸檔 | 24小時內 | System |
    And case status should be updated to "resolved_found_safe"
    And all active geofence alerts should be deactivated
    And volunteer scanning should return to normal background mode
    And case success metrics should be recorded for analysis

  @case-flow @unsuccessful-resolution @long-term-management
  Scenario: Long-term case management for unsuccessful resolutions
    Given case has been active for 72 hours without resolution
    And all immediate search resources have been exhausted
    When case transitions to long-term status
    Then case should be reclassified as "long_term_missing"
    And search strategy should shift to:
      | Strategy Change | Implementation |
      | 被動監控模式 | 志工減少為背景掃描 |
      | 定期資訊更新 | 每週向家屬報告 |
      | 媒體協助考量 | 評估公開求助可能性 |
      | 社會支援 | 連結家屬支援資源 |
      | 案件定期檢視 | 每月重新評估線索 |
    And case should remain active but with reduced resource allocation
    And family should receive realistic expectation guidance
    And long-term support services should be offered

  @case-flow @multiple-cases @resource-prioritization
  Scenario: Managing multiple concurrent cases with resource prioritization
    Given 3 active cases exist simultaneously:
      | Case ID | Priority | Duration | Resources Assigned |
      | CASE-001 | High | 2 hours | 60 volunteers |
      | CASE-002 | Medium | 8 hours | 35 volunteers |
      | CASE-003 | Low | 24 hours | 20 volunteers |
    When new high-priority case CASE-004 is created
    Then resource reallocation should be considered:
      | Reallocation Decision | Criteria | Impact |
      | 部分志工轉移 | CASE-002降為低優先 | 15位志工轉至CASE-004 |
      | 搜尋效率優化 | 重疊區域合併 | 提升整體覆蓋率 |
      | 時段錯開 | 避免志工過勞 | 輪班制度優化 |
    And case managers should coordinate to avoid resource conflicts
    And system should optimize volunteer allocation across all cases

  @case-flow @data-integration @analytics
  Scenario: Case data integration and analytics for improvement
    Given multiple cases have been resolved
    When case analytics are generated
    Then system should analyze:
      | Metric | Purpose | Frequency |
      | 平均解決時間 | 效率改善 | 月度分析 |
      | 志工響應率 | 招募優化 | 週度監控 |
      | 搜尋範圍效率 | 演算法調整 | 案件後檢討 |
      | 家屬滿意度 | 流程改善 | 季度調查 |
      | 成本效益分析 | 資源配置 | 年度評估 |
    And insights should inform workflow improvements
    And predictive models should be updated with new case data
    And best practices should be documented and shared

  @error-handling @workflow-failures @contingency-procedures
  Scenario: Handling workflow failures and system contingencies
    Given case management workflow encounters system failures
    When automated processes fail
    Then manual contingency procedures should activate:
      | Failure Type | Contingency | Timeline |
      | 志工通知系統故障 | 手動電話聯絡 | 30分鐘內 |
      | 地理圍籬失效 | 人工區域監控 | 立即 |
      | 案件資料損毀 | 備份資料回復 | 1小時內 |
      | 通訊系統中斷 | 替代通訊管道 | 15分鐘內 |
    And case manager should maintain manual logs during failures
    And family should be informed of any service disruptions
    And post-incident analysis should improve system resilience

  @monitoring @case-flow-metrics @performance-tracking
  Scenario: Case flow performance monitoring and metrics
    Given case management system is operational
    When performance monitoring runs
    Then metrics should include: average case resolution time, volunteer response rate, family satisfaction, resource utilization efficiency
    And real-time dashboards should show active case status
    And bottlenecks in workflow should be identified automatically
    And performance trends should be analyzed monthly
    And predictive indicators should warn of potential issues
    And compliance with SLA targets should be tracked and reported