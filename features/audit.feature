# Language: zh-TW
@P4 @audit @compliance @security
Feature: 稽核與匯出功能
  As a compliance officer or auditor
  I want to access comprehensive audit trails and export capabilities
  So that regulatory compliance and security monitoring can be maintained

  Background:
    Given audit system is operational
    And compliance frameworks are configured (GDPR, Taiwan PDPA)
    And user authentication is verified with appropriate audit permissions
    And audit log retention policies are active

  @audit @user-activities @comprehensive-logging
  Scenario: Comprehensive user activity audit logging
    Given various user activities occur in the system
    When audit logs are generated
    Then the following activities should be logged:
      | Activity Type | Required Fields | Retention Period |
      | 用戶登入/登出 | user_id, timestamp, IP, device, success/failure | 2 years |
      | 權限變更 | user_id, old_role, new_role, changed_by, timestamp | 7 years |
      | 案件建立/修改 | case_id, user_id, changes, timestamp, justification | 3 years |
      | 資料存取 | user_id, data_type, access_level, timestamp, purpose | 2 years |
      | 資料匯出 | user_id, data_scope, export_format, timestamp, approval_id | 7 years |
      | 同意變更 | user_id, consent_type, old_status, new_status, timestamp | 7 years |
      | 系統設定變更 | admin_id, setting_name, old_value, new_value, timestamp | 7 years |
    And all logs should be tamper-evident with cryptographic hashing
    And logs should be stored in append-only format
    And personal data in logs should be pseudonymized where possible

  @audit @data-access @privacy-compliance
  Scenario: Data access audit for privacy compliance
    Given users access personal data in the system
    When data access audit is performed
    Then system should log:
      | Data Access Event | Details | Privacy Impact |
      | 志工個人資料查看 | user_id, target_volunteer_id, fields_accessed | Medium |
      | 案件敏感資訊存取 | user_id, case_id, data_sensitivity_level | High |
      | 地理位置資料讀取 | user_id, location_data_type, time_range | High |
      | 個人識別資訊匯出 | user_id, export_scope, approval_workflow | Critical |
      | 跨境資料傳輸 | user_id, destination_country, data_type | Critical |
    And access should be correlated with business justification
    And unauthorized access attempts should trigger immediate alerts
    And data access patterns should be analyzed for anomalies
    And privacy impact assessments should be automatically flagged

  @audit @consent-lifecycle @gdpr-compliance
  Scenario: Consent lifecycle audit for GDPR Article 7 compliance
    Given consent management events occur
    When consent audit trail is generated
    Then system should record:
      | Consent Event | Required Evidence | Legal Significance |
      | 同意授予 | timestamp, consent_text_version, IP, device_info | Consent proof |
      | 同意撤回 | timestamp, user_action, withdrawal_method | Right to withdraw |
      | 同意更新 | old_consent, new_consent, user_confirmation | Version control |
      | 同意到期 | expiry_date, auto_renewal_status, user_notification | Temporal validity |
      | 同意爭議 | dispute_details, resolution_process, outcome | Legal defense |
    And consent evidence should be immediately available for regulatory inquiries
    And consent audit should demonstrate "freely given, specific, informed" criteria
    And withdrawal processing should be audited for GDPR Article 17 compliance

  @audit @security-events @incident-response
  Scenario: Security event audit and incident response tracking
    Given security-related events occur in the system
    When security audit logs are reviewed
    Then critical security events should be logged:
      | Security Event | Alert Level | Required Response |
      | 多次登入失敗 | Medium | Account lockout investigation |
      | 權限升級嘗試 | High | Immediate security review |
      | 異常資料存取模式 | High | User behavior analysis |
      | 系統漏洞利用嘗試 | Critical | Emergency response team |
      | 資料洩露指標 | Critical | Breach response protocol |
      | 惡意檔案上傳 | High | Malware analysis |
      | API濫用 | Medium | Rate limiting review |
    And security incidents should follow structured response workflow
    And incident timeline should be reconstructable from audit logs
    And security metrics should be generated for continuous improvement

  @audit @compliance-reporting @regulatory-exports
  Scenario: Compliance reporting and regulatory data exports
    Given regulatory compliance reporting is required
    When compliance officer generates reports
    Then system should provide standardized exports:
      | Report Type | Scope | Format | Frequency |
      | GDPR Article 30 記錄 | All processing activities | XML/PDF | Annual |
      | Taiwan PDPA 合規報告 | Taiwan user data | PDF/Excel | Quarterly |
      | 資料保護影響評估 | High-risk processing | PDF | Per assessment |
      | 使用者權利請求記錄 | All GDPR requests | CSV/PDF | Monthly |
      | 資料洩露通知 | Incident reports | PDF/XML | Per incident |
      | 第三方處理者稽核 | Vendor compliance | PDF | Annual |
    And exports should include all required regulatory fields
    And data should be formatted according to regulatory standards
    And export access should be logged and require dual approval

  @audit @data-lineage @processing-transparency
  Scenario: Data lineage tracking for processing transparency
    Given personal data flows through multiple system components
    When data lineage audit is performed
    Then system should track:
      | Data Flow Stage | Tracking Elements | Purpose |
      | 資料收集 | source, consent_basis, timestamp | Legal basis |
      | 資料處理 | processing_purpose, algorithm, duration | Transparency |
      | 資料傳輸 | destination, encryption, authorization | Security |
      | 資料儲存 | location, retention_period, classification | Compliance |
      | 資料刪除 | deletion_method, verification, timestamp | Right to erasure |
    And data lineage should be visualizable for audit purposes
    And processing purposes should be mapped to legal bases
    And automated data flow monitoring should detect unauthorized processing

  @audit @vendor-compliance @third-party-audit
  Scenario: Third-party vendor compliance audit
    Given external vendors process personal data on our behalf
    When vendor compliance audit is conducted
    Then audit should cover:
      | Vendor Audit Area | Requirements | Evidence |
      | 資料處理協議 | GDPR Article 28 compliance | Signed DPA |
      | 安全措施 | Technical and organizational measures | Security certification |
      | 資料傳輸 | Encryption, access controls | Transfer logs |
      | 事故回應 | Breach notification procedures | Incident reports |
      | 資料刪除 | Deletion confirmation | Destruction certificates |
      | 次級處理者 | Sub-processor agreements | Contract documentation |
    And vendor audit results should be documented and tracked
    And non-compliance issues should trigger corrective action plans
    And vendor performance should be continuously monitored

  @audit @anonymization-verification @privacy-protection
  Scenario: Anonymization process audit and verification
    Given personal data is anonymized for analytics
    When anonymization audit is performed
    Then audit should verify:
      | Anonymization Aspect | Verification Method | Success Criteria |
      | K-匿名性 | Statistical analysis | k≥3 for all groups |
      | L-多樣性 | Diversity measurement | l≥2 for sensitive attributes |
      | T-接近性 | Distribution analysis | t≤0.2 for quasi-identifiers |
      | 重新識別風險 | Risk assessment | Risk score <0.05 |
      | 連結攻擊防護 | Linkage testing | No successful linkage |
      | 推論攻擊防護 | Inference testing | No attribute inference |
    And anonymization techniques should be documented and validated
    And re-identification testing should be performed regularly
    And anonymization failures should trigger data quarantine

  @audit @cross-border-transfers @adequacy-decisions
  Scenario: Cross-border data transfer audit for GDPR compliance
    Given personal data is transferred outside Taiwan/EU
    When cross-border transfer audit is conducted
    Then audit should verify:
      | Transfer Mechanism | Required Documentation | Compliance Check |
      | 適當性決定 | EC adequacy decision status | Current validity |
      | 標準合約條款 | Executed SCCs | EDPB template compliance |
      | 約束性企業規則 | BCR authorization | Scope coverage |
      | 認證機制 | Valid certifications | Certification status |
      | 特定情況例外 | Legal basis documentation | Article 49 compliance |
    And transfer impact assessments should be documented
    And ongoing monitoring of destination country laws should be maintained
    And transfer suspension procedures should be defined

  @audit @automated-decision-making @algorithm-audit
  Scenario: Automated decision-making system audit
    Given system uses automated decision-making affecting users
    When algorithm audit is performed
    Then audit should examine:
      | Algorithm Aspect | Audit Criteria | Documentation |
      | 決策邏輯 | Transparency requirements | Logic explanation |
      | 資料輸入 | Data quality and bias | Input validation |
      | 輸出公平性 | Discriminatory impact | Fairness metrics |
      | 人工介入 | Human oversight mechanisms | Review procedures |
      | 結果解釋 | Explainability provisions | Decision rationale |
      | 申訴機制 | User challenge rights | Appeal procedures |
    And algorithmic bias should be tested across protected characteristics
    And decision outcomes should be statistically analyzed for fairness
    And algorithm changes should be version-controlled and audited

  @error-handling @audit-system-failures
  Scenario: Audit system failure handling and continuity
    Given audit system encounters technical failures
    When audit logging fails
    Then fallback procedures should activate:
      | Failure Type | Fallback Action | Recovery Timeline |
      | 日誌儲存失敗 | 本地緩存啟動 | 5分鐘內 |
      | 加密金鑰丟失 | 金鑰回復程序 | 1小時內 |
      | 稽核資料庫離線 | 次要儲存啟動 | 立即 |
      | 合規報告生成失敗 | 手動備份程序 | 4小時內 |
    And audit continuity should be maintained during system maintenance
    And audit gaps should be detected and flagged immediately
    And compensating controls should be implemented during failures
    When audit system is restored
    Then audit integrity should be verified
    And missing audit events should be reconstructed where possible

  @monitoring @audit-metrics @governance-dashboard
  Scenario: Audit metrics monitoring and governance dashboard
    Given audit system operates continuously
    When audit governance dashboard is accessed
    Then metrics should include:
      | Metric Category | Key Indicators | Review Frequency |
      | 稽核覆蓋率 | % of activities logged | Daily |
      | 合規狀態 | Outstanding compliance issues | Weekly |
      | 風險指標 | High-risk access events | Real-time |
      | 回應時間 | Incident response speed | Monthly |
      | 資料品質 | Audit log completeness | Daily |
      | 使用者權利 | GDPR request processing time | Weekly |
    And dashboards should provide drill-down capabilities
    And automated alerts should trigger for compliance violations
    And trend analysis should identify emerging risks
    And executive reporting should summarize key governance metrics