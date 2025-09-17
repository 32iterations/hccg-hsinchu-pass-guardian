# Overnight Autopilot — P2 志工 BLE 與地理通知（TDD、嚴禁變更 CLAUDE.md）

## 目的
把「志工找人網」核心能力在一夜之間做出 **最小可用**：志工模式（同意/撤回）、背景 BLE 掃描（Android / iOS 雙棧分流）、匿名化回報模型、地理通知（不含 PII）、城市節點（BLE 閘道）接入的最小伺服端。全程 **TDD（RED→GREEN→REFACTOR）**、**不可修改 CLAUDE.md**。

## Hard Rules
- 嚴禁寫入/修改 `CLAUDE.md` 與 `.policy/**`（若需提案，寫入 `docs/ADR/0002-ble-consent.md`）。  
- 僅可使用：`git status/diff/add/commit/push`、測試命令、lint/format、必要編譯；**禁止** `curl/wget/ssh/scp/sudo/chmod/chattr/mount`；禁止讀取 `.env`、`./secrets/**`。  
- 以 **TDD** 為骨架：先建 RED（只測試）、再 GREEN（最小實作）、最後 REFACTOR。  
- 資料最小化：`VolunteerHit` 僅允許（匿名 UUID、timestamp、lat/lng、RSSI、deviceHash-不可逆）。  
- 通知文案不得包含可識別個資（姓名、證號等）。

## 平台邊界（必遵）
- **Android 12+**：`BLUETOOTH_SCAN/CONNECT` 權限；若不推斷位置→ 宣示 `neverForLocation`；若要推斷位置→ 需 `ACCESS_FINE_LOCATION`（背景還需 `ACCESS_BACKGROUND_LOCATION`），權限引導分階段。  
- **iOS**：開啟 `bluetooth-central` 背景模式與 **State Preservation/Restoration**；若產生地理聯動，需 `Always` 背景定位權限。  
- 地理通知：以半徑與時效觸發；需冷卻（cooldown）避免洗版；通知文案僅描述「區域、時段、特徵提示與安全指引」。

## 要做的事（步驟與交付）
1) **探測專案測試命令**：依序嘗試 `npm|yarn|pnpm test`、`./gradlew test`、`xcodebuild test`。  
2) **RED — 志工同意/撤回**  
   - 建 `features/consent.feature`（Gherkin）：  
     - 勾選同意 → 背景掃描可啟動；  
     - 撤回或關閉開關 → **立刻停止**上傳；  
     - App 重新啟動後狀態保持一致。  
   - 寫 `ConsentManagerTest`（僅測試）。提交 `p2-red-<ts>`。  
3) **GREEN — 志工同意/撤回最小實作**  
   - `ConsentManager`（platform-agnostic use-case）＋ iOS/Android stub；讓 RED 轉綠。  
4) **RED — 背景 BLE 掃描（Android / iOS 分流）**  
   - `features/ble_scan.feature`：  
     - 權限拒絕/回收行為；  
     - App 被 kill → iOS 需 restoration callback；  
     - 命中裝置 → 上傳 `VolunteerHit`；  
     - Android 12+ 權限分流（`neverForLocation` vs 需要定位）。  
   - 建 `BleScannerTest.{android,ios}`（僅測試）。提交 RED。  
5) **GREEN — 最小掃描器**  
   - Android：偵測掃描能力、權限 gate、事件匯流；  
   - iOS：`CBCentralManager` + restoration key 回復；  
   - 以 Fake transport（HTTP/MQTT mock）上傳 `VolunteerHit`。  
6) **RED — 匿名化/去識別測試**  
   - 伺服端禁止反查個資；`deviceHash` 不可逆；`VolunteerHit` schema 校驗。  
7) **GREEN — 事件接收與聚合（Server 偽實作）**  
   - `/hits: POST`（OpenAPI 草案）→ 寫 contract test；  
   - 最小聚合：以「時空鄰近」合併多個 hit；產出 `hit-clusters`。  
8) **RED — 地理通知**  
   - `features/geo_alerts.feature`：半徑/時效/冷卻；文案 A/B（強調「撥 110、不自行圍捕」）；不得含 PII。  
9) **GREEN — 通知規則引擎**  
   - Input：`hit-clusters` 與「未結案案件（模擬資料）」；  
   - Output：志工裝置的通知任務（伺服端打 tag；客戶端只收任務，不顯個資）。  
10) **REFACTOR & 報告**  
    - 產出 `REPORT.md`（測試輸出摘要、覆蓋率、餘料與風險）；開 PR `[P2] Volunteer BLE & Geo Alerts (TDD)`。

## 輸出與分支
- `p2-red-YYYYMMDD-hhmm`（僅測試）  
- `p2-green-YYYYMMDD-hhmm`（測試全過）  
- `REPORT.md`、必要時 `docs/ADR/0002-ble-consent.md`

## 驗收門檻（CI Gate）
- 單元/契約測試全綠；匿名化測試必過；`CLAUDE.md` 未被改動；通知 A/B 文案無 PII；Android/iOS 權限流程測試通過。
