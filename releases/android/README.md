# Android APK Releases

## 新竹安心守護 Android 應用程式

### v1.0.0-firebase (2025-09-18)

**APK 下載**: 由於文件大小限制，APK 存儲在伺服器上
- **下載位置**: `/home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile/HsinchuPassGuardian/android/app/build/outputs/apk/release/app-release.apk`
- **伺服器路徑**: `147.251.115.54:/home/ubuntu/dev/hccg-hsinchu-pass-guardian/releases/android/hsinchu-pass-guardian-v1.0.0-firebase.apk`
- **大小**: 52MB
- **最低 Android 版本**: API 24 (Android 7.0)
- **目標 Android 版本**: API 35 (Android 15)

#### 🔥 主要功能
- ✅ **Firebase 推播通知** - 完整整合 FCM
- ✅ **失智症患者定位追蹤** - GPS + 藍牙信標
- ✅ **地理圍欄警報** - 離開/進入安全區域通知
- ✅ **SOS 緊急求救** - 一鍵求救功能
- ✅ **異常行為偵測** - AI 智慧監控
- ✅ **即時地圖顯示** - Google Maps 整合
- ✅ **多重身份管理** - 家屬、照護員、醫護人員

#### 📱 技術規格
- **框架**: React Native 0.75+
- **推播**: Firebase Cloud Messaging (FCM)
- **地圖**: Google Maps API
- **定位**: GPS + 網路定位
- **藍牙**: BLE 4.0+ 支援
- **後端**: Node.js + PostgreSQL + Redis

#### 🔧 安裝說明
1. 在 Android 設備上啟用「未知來源」安裝
2. 下載 APK 文件
3. 點擊安裝
4. 授予必要權限（位置、相機、通知）
5. 註冊帳號並開始使用

#### 🔗 相關連結
- **API 後端**: http://147.251.115.54:3001
- **健康檢查**: http://147.251.115.54:3001/health
- **測試帳號**: test@hsinchu.gov.tw / test123

#### 📋 權限要求
- `ACCESS_FINE_LOCATION` - 精確位置追蹤
- `ACCESS_COARSE_LOCATION` - 大致位置追蹤
- `CAMERA` - QR Code 掃描
- `BLUETOOTH` - 藍牙信標連接
- `NOTIFICATIONS` - 推播通知
- `INTERNET` - 網路連線

---
*此版本包含完整的 Firebase 推播通知功能，可接收地理圍欄警報、SOS 求救和異常偵測通知。*