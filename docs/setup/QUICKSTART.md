# ⚡ 快速啟動指南

## 30 秒啟動

```bash
# 1. 開啟專案
code .

# 2. 進入 DevContainer
# 按 F1 → "Dev Containers: Reopen in Container"
# 或點擊左下角 "><" → "Reopen in Container"

# 3. 容器內執行自動化
bash scripts/run_overnight.sh
```

## 🎯 就這樣！

系統會自動：
1. ✅ 偵測測試框架
2. ✅ 執行 TDD 循環 (RED→GREEN→REFACTOR)
3. ✅ 建立測試與實作
4. ✅ 產生報告
5. ✅ 建立 Pull Request

## 📊 監看進度

```bash
# 另開終端視窗
tail -f logs/*/runner.log
```

## 🔍 檢查結果

執行完成後會看到：
- `REPORT.md` - 完整執行報告
- 新的 PR 在 GitHub 上
- 測試覆蓋率報告

## ⚠️ 如果遇到問題

```bash
# 檢查 Docker 是否啟動
docker --version

# 確認在 DevContainer 內
echo $CONTAINER_ENV

# 手動執行設定
bash setup.sh
```

---
**提醒**: CLAUDE.md 是唯讀的，不要嘗試修改它！