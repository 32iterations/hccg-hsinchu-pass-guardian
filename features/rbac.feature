# Language: zh-TW
@P4 @rbac @security @access-control
Feature: 角色權限控制系統
  As a system administrator
  I want to manage user roles and permissions
  So that access to sensitive data and functions is properly controlled

  Background:
    Given RBAC system is initialized
    And role definitions are loaded
    And permission matrix is configured
    And audit logging is enabled

  @rbac @roles @definition
  Scenario: System role definitions with clear boundaries
    Given the RBAC system defines user roles
    Then the following roles should exist:
      | Role | Chinese Name | Access Level | Scope |
      | volunteer | 志工用戶 | Basic | Own volunteer data only |
      | family_member | 家屬成員 | Limited | Own family case data only |
      | case_manager | 案件管理員 | Medium | Assigned cases and volunteers |
      | supervisor | 主管 | High | Regional cases and staff |
      | admin | 系統管理員 | Full | System-wide access |
      | auditor | 稽核員 | Read-only | All data for compliance |
      | emergency_operator | 緊急通報員 | Special | Emergency case creation |
    And each role should have clearly defined permissions
    And role inheritance should be explicitly configured

  @rbac @volunteer @permissions
  Scenario: Volunteer role permissions and restrictions
    Given I am authenticated as a volunteer user
    When I attempt to access system functions
    Then I should be able to:
      | Function | Access | Explanation |
      | 啟用志工模式 | Allow | Core volunteer function |
      | 查看自己的貢獻統計 | Allow | Own data visibility |
      | 更新個人設定 | Allow | Self-service configuration |
      | 撤回志工同意 | Allow | Privacy right |
      | 回報可疑活動 | Allow | Safety function |
    But I should NOT be able to:
      | Function | Deny Reason |
      | 查看其他志工資料 | Privacy protection |
      | 存取案件詳細資訊 | Information security |
      | 修改系統設定 | Privilege escalation |
      | 匯出資料 | Data protection |

  @rbac @family-member @case-access
  Scenario: Family member role with case-specific access
    Given I am authenticated as a family member
    And I have reported case "CASE-2025-091701"
    When I access case-related functions
    Then I should be able to:
      | Function | Scope | Limitation |
      | 查看案件進度 | Own case only | No other cases |
      | 更新案件資訊 | Own case details | With approval workflow |
      | 接收進度通知 | Own case updates | Automated delivery |
      | 下載案件報告 | Own case summary | Redacted sensitive info |
      | 聯絡案件管理員 | Assigned manager | Through secure messaging |
    But access should be revoked immediately when case is closed
    And no access to system administration functions

  @rbac @case-manager @operational-access
  Scenario: Case manager role with multi-case operational permissions
    Given I am authenticated as a case manager
    And I am assigned to handle cases in "中正區"
    When I perform case management duties
    Then I should be able to:
      | Function | Scope | Audit Required |
      | 建立新案件 | My jurisdiction | Yes |
      | 指派志工協助 | Available volunteers | Yes |
      | 更新案件狀態 | Assigned cases | Yes |
      | 存取志工位置資料 | Active case related | Yes |
      | 產生進度報告 | Assigned cases | Yes |
      | 聯絡家屬成員 | Case participants | Yes |
    But I should NOT access cases outside my jurisdiction
    And all actions should be logged for audit
    And sensitive personal data access should require justification

  @rbac @emergency-operator @special-permissions
  Scenario: Emergency operator role with time-sensitive access
    Given I am authenticated as an emergency operator
    And emergency case creation is required
    When emergency situation occurs
    Then I should be able to:
      | Function | Special Access | Time Limit |
      | 立即建立緊急案件 | Skip normal validation | 15 minutes |
      | 啟動大範圍志工招募 | Override privacy settings | Case duration |
      | 發送緊急通知 | All users in area | Supervisor approval |
      | 存取即時位置資料 | Safety justification | 4 hours |
      | 聯絡緊急服務 | Direct 110/119 integration | Case duration |
    And emergency access should auto-expire after case resolution
    And supervisor should be notified of all emergency access usage
    And post-incident review should be mandatory

  @rbac @admin @system-management
  Scenario: System administrator role with full access and accountability
    Given I am authenticated as a system administrator
    When I perform administrative functions
    Then I should be able to:
      | Function | Access Level | Audit Level |
      | 用戶角色管理 | Full CRUD | High |
      | 系統設定調整 | All parameters | Critical |
      | 資料庫維護 | Direct access | Critical |
      | 安全政策更新 | Security configs | Critical |
      | 系統監控查看 | All metrics | Medium |
      | 備份還原操作 | Data recovery | Critical |
    And all administrative actions should require multi-factor authentication
    And critical operations should require dual approval
    And comprehensive audit logs should be maintained
    And admin access should be regularly reviewed and revalidated

  @rbac @auditor @compliance-access
  Scenario: Auditor role with read-only compliance access
    Given I am authenticated as an auditor
    When I perform compliance review
    Then I should be able to:
      | Function | Access Type | Purpose |
      | 查看所有用戶活動日誌 | Read-only | Compliance monitoring |
      | 存取資料保存記錄 | Read-only | Retention compliance |
      | 查看權限變更歷史 | Read-only | Security audit |
      | 產生合規報告 | Export capability | Regulatory reporting |
      | 查看系統配置 | Read-only | Security assessment |
    But I should NOT be able to:
      | Restricted Function | Reason |
      | 修改任何數據 | Audit independence |
      | 存取即時個人資料 | Privacy protection |
      | 刪除審計日誌 | Evidence preservation |
    And auditor access should be time-limited per audit period
    And auditor activities should themselves be logged

  @rbac @permission-inheritance @role-hierarchy
  Scenario: Role hierarchy and permission inheritance
    Given role hierarchy is defined as:
      | Parent Role | Child Role | Inherited Permissions |
      | admin | supervisor | All supervisor permissions |
      | supervisor | case_manager | All case manager permissions |
      | case_manager | emergency_operator | Emergency response capabilities |
    When permission check is performed
    Then higher roles should inherit lower role permissions
    And explicit denials should override inherited permissions
    And permission conflicts should be resolved by most restrictive rule
    And inheritance chain should be limited to 3 levels maximum
    And circular inheritance should be prevented and detected

  @rbac @dynamic-permissions @context-aware
  Scenario: Dynamic permissions based on context and situation
    Given I have case_manager role
    And emergency situation is declared
    When context-aware permissions are evaluated
    Then my permissions should be temporarily elevated to include:
      | Enhanced Permission | Context | Duration |
      | 跨區域案件存取 | Emergency response | Emergency period |
      | 即時志工聯絡 | Urgent coordination | 2 hours |
      | 優先系統資源 | Critical operations | Emergency period |
    And elevated permissions should auto-revoke when context changes
    And permission elevation should be logged with context justification
    And supervisor should be notified of permission elevation

  @rbac @delegation @temporary-access
  Scenario: Permission delegation for temporary coverage
    Given I am a case manager going on leave
    And I need to delegate my responsibilities
    When I delegate permissions to colleague "張管理員"
    Then delegation should require supervisor approval
    And delegated permissions should be time-limited (maximum 30 days)
    And original permission holder should retain read-only access
    And delegation should be revocable by delegator or supervisor
    And delegated access should be clearly marked in audit logs
    And delegation should auto-expire at specified time

  @rbac @geo-permissions @location-based-access
  Scenario: Geographic-based permission restrictions
    Given I am a case manager assigned to "東區"
    When I attempt to access case data
    Then I should only access cases within my geographic jurisdiction
    And cross-region access should require supervisor approval
    And emergency situations may grant temporary cross-region access
    And location-based restrictions should be configurable per role
    And geographic boundaries should be clearly defined in system
    And location-based access violations should trigger security alerts

  @error-handling @rbac-failures
  Scenario: Handling RBAC system failures and security incidents
    Given RBAC system encounters technical difficulties
    When permission check fails
    Then system should fail-safe (deny access by default)
    And fallback to read-only access may be granted to essential roles
    And security team should be immediately notified
    And incident should be logged with full context
    And manual override should require dual approval
    And system should switch to enhanced audit mode during failures
    When RBAC system is restored
    Then all fallback access should be immediately revoked
    And comprehensive security review should be conducted

  @monitoring @rbac-analytics @security-metrics
  Scenario: RBAC system monitoring and security analytics
    Given RBAC system is operational
    When security monitoring runs
    Then metrics should include: permission check frequency, access denials, role assignments, privilege escalations
    And unusual access patterns should trigger alerts
    And failed authentication attempts should be tracked
    And role effectiveness should be analyzed quarterly
    And permission utilization should inform role optimization
    And security incidents should be correlated with permission events
    And compliance metrics should be generated for regulatory reporting