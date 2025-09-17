# Overnight Autopilot — P3 MyData 申辦 × 進度追蹤 × 撤回即刪（TDD）

## 目的
將「預防走失手鍊」透過 MyData 串接：**授權 → 取件 → 回執 → 進度追蹤 → 撤回即刪**。全程 TDD；資料保存 **最小化**；所有回執/同意紀錄可稽核；**禁止修改 CLAUDE.md**。

## Hard Rules
- 不得寫入/修改 `CLAUDE.md` 與 `.policy/**`；若需提案，寫 `docs/ADR/0003-mydata.md`。  
- 僅允許 `git*`、測試、lint、build 指令；禁止 `curl/wget/ssh/scp/sudo/...`；禁止讀 `.env`、`./secrets/**`。  
- MyData 為 **單次即時取用**；回執/個資保存期限需最小化並可設定 TTL；撤回請求觸發**立即刪除**。  
- 不在伺服端長期保存 MyData 原始檔；僅保存必要欄位與稽核記錄（操作者、時間、依據）。

## 要做的事（TDD 流程）
1) **探測測試命令**；若無，建立最小測試框架。  
2) **RED — 合約測試（Contract）**  
   - 建 `contracts/mydata.callback.json` schema；  
   - `tests/mydata.contract.test` 驗證：授權回調 payload 完整性、簽章欄位（若有）、重放防護（nonce/timestamp）。  
3) **GREEN — `MyDataAdapter` 偽實作**  
   - 支援：`authorize()`、`handleCallback()`、`fetchReceipt()`；只讓合約測試綠。  
4) **RED — 回執保存與 TTL**  
   - `features/retention.feature`：回執與個資保存 ≤ N 天；到期自動清除，但**保留稽核 log**。  
5) **GREEN — 保存/刪除 Job**  
   - 排程/批次（cron or worker）+ 稽核紀錄（who/when/why）；刪除僅留不可逆摘要。  
6) **RED — 撤回流程**  
   - `features/revoke.feature`：使用者撤回 → 所有可識別資料立即刪除；查詢回傳 `410 Gone` 或同等標記；稽核 log 保留。  
7) **GREEN — 撤回最小實作**  
   - `MyDataAdapter.revoke()`；刪除後不可再取件；回執列表過濾。  
8) **RED — 進度追蹤與通知**  
   - `features/tracking.feature`：狀態變更（受理、審核、核發）回寫 App；過期/換發提醒；通知節流。  
9) **GREEN — 最小追蹤服務**  
   - `GET /mydata/cases/:id/status` 偽實作；測試資料驅動 UI；通知排程。  
10) **REFACTOR & 文檔**  
   - 產出 `REPORT.md`（流程圖、OpenAPI 草案、測試摘要、TTL 設定）；必要時 `docs/ADR/0003-mydata.md`。

## 輸出
- 分支：`p3-red-YYYYMMDD-hhmm`、`p3-green-YYYYMMDD-hhmm`  
- 檔案：`contracts/mydata.callback.json`、`REPORT.md`、`docs/ADR/0003-mydata.md`

## 驗收
- 合約、TTL、撤回測試全綠；稽核 log 可查；未超留；`CLAUDE.md` hash 未改變。
