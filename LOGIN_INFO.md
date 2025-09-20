# 新竹通行守護者 - 登入資訊 🔐

## 📱 APK 下載連結
- **最新版本 v1.6.5 (Leaflet地圖版)**
- GitHub Release: https://github.com/your-repo/releases/tag/v1.6.5
- 檔案: `app-release.apk`

## 🔑 測試登入帳號

### 方法一：使用測試帳號 (推薦)
由於後端資料庫尚未完全設置，目前提供以下測試帳號可直接登入：

```
帳號 1 - 一般測試:
Email: test@example.com
密碼: Test123456

帳號 2 - Demo展示:
Email: demo@hsinchu.com
密碼: Demo2025
```

### 方法二：Firebase 登入 (備用)
如果無法使用上述帳號，系統會自動切換到 Firebase 登入：
- 可使用任何有效的 Email 註冊新帳號
- 或使用 Google 帳號快速登入

## ✅ 功能清單（全部保留）

### 主要功能介面：
1. ✅ **登入/註冊** - 完整保留
2. ✅ **主選單** - 完整保留
3. ✅ **患者管理** - 完整保留
4. ✅ **警報記錄** - 完整保留
5. ✅ **信標掃描** - 完整保留
6. ✅ **系統設定** - 完整保留
7. ✅ **通知中心** - 完整保留

### 地圖功能（新舊版本並存）：
- **主要使用：Leaflet 新竹地圖版** ✨
  - 即時定位 - 使用 OpenStreetMap
  - 地理圍欄 - 新竹在地地標推薦

- **備用版本：Google Maps**（仍可切換使用）
  - GoogleRealTimeMap
  - GoogleRealGeofence
  - 原始地圖功能

## 🚀 如何登入

1. **安裝 APK**
   - 下載 `app-release.apk`
   - 在手機設定中允許安裝未知來源應用程式
   - 安裝並開啟應用程式

2. **登入步驟**
   - 開啟應用程式
   - 在登入畫面輸入測試帳號
   - Email: `test@example.com`
   - 密碼: `Test123456`
   - 點擊「登入」按鈕

3. **若登入失敗**
   - 檢查網路連線
   - 嘗試使用 Firebase 註冊新帳號
   - 或聯繫技術支援

## 📝 注意事項

- 目前 APK 設定連接到外部 IP (147.251.115.54:3000)
- 如需連接本地測試，請修改 `config.ts` 中的 API_BASE_URL
- 所有原有功能都已保留，只是地圖實現改為 Leaflet

## 🆘 技術支援

如有問題請聯繫開發團隊或在 GitHub Issues 回報。

---
更新日期：2024-12-20
版本：v1.6.5 (Leaflet Edition)