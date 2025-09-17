# Overnight Autopilot — P4 承辦 Console（案件流 × RBAC × 稽核 × KPI）

## 目的
做出最小可用的承辦端 Console：案件建立→派發→結案；**最小權限（RBAC）**；所有讀取/匯出**留痕**（操作者/時間/目的）；KPI 匯總（不顯個資）；全程 TDD；**不可修改 CLAUDE.md**。

## Hard Rules
- 禁止寫入/修改 `CLAUDE.md` 與 `.policy/**`；如需變更，提 ADR。  
- 只允許 `git*`、測試、lint、build；禁止高風險系統指令與讀 secrets。  
- 匯出必帶浮水印（操作人、時間、用途）；**單筆查詢不可識別**（僅匯總或經最小必要遮罩）。

## 要做的事（TDD）
1) **探測測試命令**；若無，建立最小 Web/E2E 測試（如 Playwright/Cypress）與伺服端單元測試。  
2) **RED — RBAC**  
   - `features/rbac.feature`：非承辦角色看不到敏感欄（個資列）、敏感操作需授權；  
   - `RbacGuardTest`。  
3) **GREEN — 最小 RBAC**  
   - 角色：Viewer/Operator/Admin；策略：可見欄、允許操作白名單。  
4) **RED — 案件流**  
   - `features/case_flow.feature`：建立→派發→結案；結案觸發清理解聯資料（最小保留）。  
5) **GREEN — 案件流最小實作**  
   - `CaseService` + REST（`/cases`）假資料；通過測試即可。  
6) **RED — 稽核與匯出**  
   - `features/audit.feature`：所有讀取/下載留痕；匯出自動加浮水印；log 不可修改。  
7) **GREEN — 稽核最小實作**  
   - `AuditLogService`（append-only）；匯出模板自動疊浮水印。  
8) **RED — KPI 匯總（去識別）**  
   - `features/kpi.feature`：覆蓋率、到案時效、誤報率、推播送達；不可進行單筆下鑽；輸出僅群組統計。  
9) **GREEN — KPI 最小實作**  
   - 以假資料或 ETL mock 計算；圖表元件 stub。  
10) **REFACTOR & 文檔**  
    - `REPORT.md`（角色矩陣、狀態機、KPI 定義、E2E 螢幕截圖）。

## 輸出
- 分支：`p4-red-YYYYMMDD-hhmm`、`p4-green-YYYYMMDD-hhmm`  
- 檔案：`REPORT.md`、`features/*.feature`、測試程式與最小實作

## 驗收
- RBAC/案件流/稽核/KPI 測試全綠；E2E 截圖附在 `REPORT.md`；`CLAUDE.md` hash 比對一致。
