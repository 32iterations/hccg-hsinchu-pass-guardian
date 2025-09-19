# Release v1.3.1 - 修正 Android 9+ 網路連線問題

## 發布日期
2025-09-19

## 版本資訊
- **版本號**: 1.3.1
- **版本代碼**: 5
- **APK 大小**: 約 53MB

## 主要修正

### 🐛 Bug 修正
- **修正 Android 9+ HTTP 連線問題**
  - 更新 `network_security_config.xml` 以允許 HTTP 連線
  - 新增特定域名白名單，包含：
    - api.hsinchu.dpdns.org
    - hsinchu.dpdns.org
  - 解決「網路連線錯誤」問題

### 🔧 技術變更
- 更新 `cleartextTrafficPermitted` 為 `true`
- 配置 API_BASE_URL 為 HTTP 協議
- 修正 Nginx upstream 配置指向正確的後端服務

## 測試帳號
- **管理員帳號**: admin@hsinchu.gov.tw / admin123
- **一般用戶帳號**: test@example.com / test123

## 系統需求
- Android 7.0 (API 24) 或以上
- 網路連線（支援 HTTP/HTTPS）
- 位置權限（用於定位功能）

## 安裝說明
1. 下載 `app-release.apk`
2. 允許安裝未知來源應用程式
3. 安裝並開啟應用程式
4. 使用提供的測試帳號登入

## 後端服務狀態
- ✅ API 服務運行正常: http://api.hsinchu.dpdns.org
- ✅ 管理後台運行正常: http://admin.hsinchu.dpdns.org
- ✅ 資料庫服務運行正常

## 注意事項
- 此版本支援 HTTP 連線，適用於開發和測試環境
- 生產環境建議使用 HTTPS 連線以確保資料安全

## 技術支援
如遇到任何問題，請聯繫技術支援團隊。