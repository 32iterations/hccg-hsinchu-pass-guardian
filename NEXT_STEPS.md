# 🚀 接下來的步驟 - 完成 APP 建置

## 📋 當前狀態
- ✅ Firebase 憑證已設定
- ✅ React Native 專案已創建
- ✅ Android 環境已配置
- ✅ 依賴套件已安裝
- ✅ 自動化腳本已準備
- 🔄 APK 建置進行中

## 🎯 立即執行（在 tmux 中）

```bash
# 選項 1: 使用 tmux 持久會話（推薦）
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile
./tmux-build.sh

# 查看進度
tmux attach -t hsinchu-app-build
```

## 💬 給 Claude 的完整提示詞

當你回來時，可以使用以下提示詞讓 Claude 繼續：

---

**提示詞 1：檢查建置狀態**
```
請檢查 /home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile/HsinchuPassGuardian/apk-output/ 目錄，
看看 APK 是否已經建置完成。如果有錯誤，請查看 build-logs 目錄中的日誌檔案並修復問題。
```

**提示詞 2：完成剩餘工作**
```
請完成新竹安心守護 APP 的剩餘工作：
1. 確認 APK 建置成功
2. 如果失敗，修復建置錯誤
3. 測試 APK 在模擬器或實機上的運行
4. 準備 Google Play Store 上架資料
5. 生成最終的部署文檔
```

**提示詞 3：優化和增強功能**
```
APP 基礎架構已完成，請幫我：
1. 優化 BLE 背景掃描的電池使用
2. 實作更完整的地理圍欄功能
3. 加入使用者登入介面
4. 整合後端 API 連接
5. 添加離線資料同步機制
```

**提示詞 4：除錯和問題解決**
```
如果建置失敗，請：
1. 檢查 /home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile/HsinchuPassGuardian/build-logs/ 中的錯誤日誌
2. 修復 gradle 相依性問題
3. 解決 Firebase 配置錯誤
4. 處理 Android SDK 版本衝突
5. 重新執行建置腳本
```

## 📁 重要檔案位置

```
# 專案根目錄
/home/ubuntu/dev/hccg-hsinchu-pass-guardian/

# React Native APP
mobile/HsinchuPassGuardian/

# 建置腳本
mobile/auto-build.sh          # 自動建置腳本
mobile/tmux-build.sh         # Tmux 會話腳本

# Firebase 憑證
config/firebase-admin.json    # 後端用
mobile/HsinchuPassGuardian/android/app/google-services.json   # Android 用
mobile/HsinchuPassGuardian/ios/GoogleService-Info.plist       # iOS 用

# 輸出檔案
mobile/HsinchuPassGuardian/apk-output/   # APK 檔案
mobile/HsinchuPassGuardian/build-logs/   # 建置日誌
```

## 🔧 快速命令

```bash
# 查看建置進度
tmux attach -t hsinchu-app-build

# 查看即時日誌
tail -f /home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile/HsinchuPassGuardian/build-logs/build-*.log

# 手動建置 Debug APK
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile/HsinchuPassGuardian/android
./gradlew assembleDebug

# 手動建置 Release APK
./gradlew assembleRelease

# 清理建置
./gradlew clean
```

## ⚠️ 常見問題解決

### 問題 1: Gradle 下載緩慢
```bash
# 使用國內鏡像
echo "systemProp.https.proxyHost=127.0.0.1" >> gradle.properties
echo "systemProp.https.proxyPort=7890" >> gradle.properties
```

### 問題 2: 記憶體不足
```bash
# 增加 Gradle 記憶體
echo "org.gradle.jvmargs=-Xmx4096M" >> gradle.properties
```

### 問題 3: NDK 未安裝
```bash
# 自動下載會處理，或手動安裝
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "ndk;27.1.12297006"
```

## 📱 測試 APK

建置完成後，可以：

1. **使用 ADB 安裝到實機**
```bash
adb install mobile/HsinchuPassGuardian/apk-output/HsinchuGuardian-debug-*.apk
```

2. **傳輸到手機**
- 將 APK 檔案傳到手機
- 在手機設定中允許「安裝未知來源應用程式」
- 點擊 APK 檔案安裝

## 🎯 下一階段目標

1. **功能完善**
   - 使用者註冊/登入
   - 家屬/志工角色切換
   - 案件管理介面
   - 即時通知系統

2. **效能優化**
   - 減少電池消耗
   - 優化背景服務
   - 資料快取機制

3. **上架準備**
   - 應用程式圖標設計
   - 商店截圖準備
   - 隱私政策撰寫
   - 使用條款制定

---

**建置預計時間**: 10-20 分鐘
**檔案大小**: Debug APK 約 30-50MB, Release APK 約 15-25MB

祝建置順利！🚀