# 🔄 Claude 實例協作系統

## 檔案鎖定機制
每個 Claude 在修改檔案前必須：
1. 檢查 /tmp/claude-locks/ 目錄
2. 創建鎖定檔案：/tmp/claude-locks/{filename}.lock
3. 完成後刪除鎖定檔案

## 實例識別
- Claude-1: 資料庫專家 (DB)
- Claude-2: 手機開發 (MOBILE)
- Claude-3: 地理圍籬 (GEO)
- Claude-4: 儀表板部署 (DASH)

## 共享狀態檔案
位置：/tmp/claude-status/
- shared-state.json: 即時共享狀態
- file-ownership.json: 檔案所有權記錄
- test-results.json: 測試結果共享

## TDD 嚴格標準 ⚠️
1. **必須先寫測試**：任何功能實作前必須有失敗的測試
2. **測試必須通過**：不允許跳過測試（除非有文檔說明的特殊原因）
3. **測試覆蓋率**：目標 95% 以上
4. **測試命名**：describe('功能名稱') > it('應該...')

## 溝通協議
每個 Claude 每 10 分鐘更新：
```json
{
  "instance": "MOBILE",
  "timestamp": "2025-01-18T10:00:00Z",
  "working_on": ["mobile/App.tsx", "mobile/tests/App.test.tsx"],
  "status": "writing_tests",
  "test_status": "failing",
  "blocked_by": null
}
```

## 衝突解決
1. 檢查檔案鎖定
2. 查看 file-ownership.json
3. 等待或協調
4. 永不覆蓋他人工作