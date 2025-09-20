# 🔍 Google Maps 載入問題調試指南

## 📋 問題診斷檢查清單

### 1. 執行調試腳本
```bash
chmod +x debug-maps.sh
./debug-maps.sh
```

### 2. 關鍵日誌訊息檢查

請在運行應用程式時觀察以下日誌：

#### ✅ 正常日誌應包含：
```
D/MainApplication: Starting application initialization
D/MainApplication: Initializing Google Maps SDK...
D/MainApplication: Google Maps SDK initialized with latest renderer
D/MapScreen: Starting Google Maps initialization...
D/MapScreen: Force setting map ready after 3 seconds
D/MapScreen: Google Maps onMapReady callback fired (可選)
```

#### ❌ 錯誤日誌可能包含：
```
E/GoogleMaps: Authorization failure
E/GoogleMaps: API key not found
E/GoogleMaps: Network error
E/MainApplication: Error initializing Google Maps
```

## 🔧 快速修復方案

### 方案 A：API 金鑰問題
1. 檢查 Google Cloud Console
2. 確認 Maps SDK for Android 已啟用
3. 確認 API 金鑰沒有限制或限制包含您的應用程式包名

### 方案 B：網路問題
1. 確認設備有網路連接
2. 檢查防火牆設置
3. 測試 Google 服務是否可訪問

### 方案 C：快速切換模擬地圖
- 應用程式現在會在 3 秒後自動顯示地圖
- 如果 10 秒後仍有問題，會提示切換模擬地圖

## 📱 測試步驟

### 1. 清理並重新安裝
```bash
cd android
./gradlew clean
./gradlew assembleRelease
adb uninstall com.hccg.hsinchu.passguardian
adb install app/build/outputs/apk/release/app-release.apk
```

### 2. 收集完整日誌
```bash
# 清除舊日誌
adb logcat -c

# 啟動應用並收集日誌
adb logcat -d > maps_debug.log

# 檢查關鍵錯誤
grep -E "Maps|API|Authorization|Error" maps_debug.log
```

### 3. 檢查 API 金鑰配置
```bash
# 解壓 APK 檢查
unzip -p app-release.apk AndroidManifest.xml | strings | grep -A2 -B2 "API_KEY"
```

## 🚀 已實施的修復

### v1.6.0 修復內容：

1. **移除 onMapReady 依賴**
   - 不再無限等待 onMapReady 回調
   - 3 秒後自動設置地圖為就緒狀態

2. **改進 MainApplication.kt**
   - 添加 Google Maps SDK 初始化
   - 添加詳細日誌記錄

3. **優化載入邏輯**
   - 減少超時時間從 45 秒到 10 秒
   - 提供更好的用戶反饋

4. **新增 onMapLoaded 回調**
   - 多重檢測機制確保地圖載入

## 🎯 期望結果

應用程式應該在 3 秒內：
1. 顯示地圖（Google Maps 或模擬地圖）
2. 不再顯示「正在載入...」超過 3 秒
3. 如果 Google Maps 失敗，自動提供切換選項

## 📞 進階調試

如果問題持續，請執行：

```bash
# 獲取設備資訊
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.model

# 檢查 Google Play 服務
adb shell pm list packages | grep google.android.gms

# 檢查權限
adb shell dumpsys package com.hccg.hsinchu.passguardian | grep permission
```

## 💡 最終建議

如果 Google Maps 仍無法載入：
1. 使用模擬地圖功能（功能完整）
2. 檢查設備是否有 Google Play 服務
3. 考慮使用 VPN 如果在特定地區有限制

---
更新日期：2025-01-20
版本：v1.6.0