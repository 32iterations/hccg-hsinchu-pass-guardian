#!/bin/bash

echo "==================================="
echo "Google Maps 調試工具 v1.0"
echo "==================================="
echo ""

# 檢查 adb 是否可用
if ! command -v adb &> /dev/null; then
    echo "❌ 錯誤：請先安裝 Android Debug Bridge (adb)"
    echo "   在 Ubuntu 上運行: sudo apt-get install android-tools-adb"
    exit 1
fi

# 檢查設備連接
echo "🔍 檢查連接的 Android 設備..."
DEVICES=$(adb devices | grep -v "List of devices attached" | grep -v "^$")

if [ -z "$DEVICES" ]; then
    echo "❌ 未檢測到 Android 設備"
    echo ""
    echo "請確保："
    echo "1. 手機已通過 USB 連接"
    echo "2. 開發者模式已啟用"
    echo "3. USB 調試已開啟"
    exit 1
fi

echo "✅ 檢測到設備："
echo "$DEVICES"
echo ""

# 清除舊日誌
echo "🧹 清除舊日誌..."
adb logcat -c

echo "📊 開始收集 Google Maps 相關日誌..."
echo "（按 Ctrl+C 停止收集）"
echo ""
echo "==================================="
echo "重要日誌將顯示在下方："
echo "==================================="
echo ""

# 過濾 Google Maps 和 React Native 相關日誌
adb logcat -v time \
    GoogleMaps:V \
    MapsInitializer:V \
    MapView:V \
    ReactNative:V \
    ReactNativeJS:V \
    AndroidRuntime:E \
    System.err:W \
    *:S | grep -E "(Maps|maps|MAP|ReactNative|hsinchupassguardian|API_KEY|Google|Authorization|Failed|Error|error|exception|Exception|crash)"