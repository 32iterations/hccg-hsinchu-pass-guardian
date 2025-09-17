# ✅ 驗收清單 - 過夜自動化執行

**執行日期**: ________________
**執行時間**: ________________
**執行者**: ________________

## 🔒 策略保護驗證

### CLAUDE.md 完整性
- [ ] **雜湊值一致** - 執行前後 SHA256 相同
  ```bash
  # 驗證命令
  sha256sum .policy/CLAUDE.md
  cat logs/*/claude_md.sha256  # 比對原始雜湊
  ```
- [ ] **檔案未被修改** - 修改時間未變更
- [ ] **唯讀保護有效** - .policy/ 目錄仍為唯讀

## 🌿 分支驗證

### RED 分支 (p1-red-YYYYMMDD-HHMM)
- [ ] **分支存在**
  ```bash
  git branch -a | grep p1-red
  ```
- [ ] **只含測試檔案**
  ```bash
  git diff main..p1-red-* --name-only | grep -v test
  # 應該沒有輸出（只有測試檔）
  ```
- [ ] **測試失敗** (RED 階段特徵)
  ```bash
  git checkout p1-red-*
  npm test  # 應該失敗
  ```
- [ ] **提交訊息正確** - 以 `[RED]` 開頭
  ```bash
  git log --oneline p1-red-* | head -5
  ```

### GREEN 分支 (p1-green-YYYYMMDD-HHMM)
- [ ] **分支存在**
  ```bash
  git branch -a | grep p1-green
  ```
- [ ] **測試全部通過**
  ```bash
  git checkout p1-green-*
  npm test  # 應該全部通過
  ```
- [ ] **包含實作檔案**
  ```bash
  git diff p1-red-*..p1-green-* --name-only | grep -E "src/.*\.js"
  ```
- [ ] **提交訊息正確** - 以 `[GREEN]` 開頭
  ```bash
  git log --oneline p1-green-* | head -5
  ```

## 📊 報告與文件

### REPORT.md
- [ ] **檔案存在**
  ```bash
  ls -la REPORT.md logs/*/REPORT.md
  ```
- [ ] **包含測試摘要**
  - [ ] 測試數量
  - [ ] 通過/失敗狀態
  - [ ] 覆蓋率百分比
- [ ] **包含功能清單**
  - [ ] 裝置綁定 (NCC 驗證)
  - [ ] 圍籬引擎 (進入/離開偵測)
- [ ] **風險評估章節**
  - [ ] 無真實憑證
  - [ ] 無個資外洩
  - [ ] 符合平台政策

### 執行日誌
- [ ] **日誌完整**
  ```bash
  ls -la logs/*/
  # 應包含: runner.log, error.log, test_output.txt, claude_output.json
  ```
- [ ] **無嚴重錯誤**
  ```bash
  grep -i "fatal\|error" logs/*/error.log
  ```

## 🐙 GitHub 整合

### Pull Request
- [ ] **PR 已建立** (如有設定 gh CLI)
  ```bash
  gh pr list --state open | grep "P1"
  ```
- [ ] **標題正確** - `[P1] Device binding & Geofence MVP (TDD)`
- [ ] **描述完整** - 包含 REPORT.md 內容
- [ ] **無 AI 署名** - 不含 "Claude" 或 "AI" 字樣
  ```bash
  gh pr view --json body | grep -i "claude\|ai"
  # 應該沒有輸出
  ```

### CI 狀態
- [ ] **CI 測試通過** (如有設定 Actions)
- [ ] **安全掃描通過**
- [ ] **覆蓋率達標** (≥80%)

## 🧪 測試驗證

### 單元測試
- [ ] **裝置綁定測試**
  - [ ] NCC 型式證號驗證
  - [ ] 重複序號阻擋
  - [ ] 中文警語顯示
- [ ] **圍籬引擎測試**
  - [ ] 進入偵測 (10m 精度)
  - [ ] 離開偵測 (30s 延遲)
  - [ ] 冷卻機制 (5 分鐘)

### 程式碼品質
- [ ] **Linting 通過**
  ```bash
  npm run lint
  ```
- [ ] **無安全漏洞**
  ```bash
  npm audit --audit-level=high
  ```

## 🚦 整體狀態

### 成功指標
- [ ] **TDD 流程完整** - RED→GREEN→REFACTOR
- [ ] **無違反策略** - CLAUDE.md 未被修改
- [ ] **測試覆蓋率** ≥ 80%
- [ ] **自動化完成** - 無需人工介入

### 問題記錄
如有任何問題，請記錄於此：

```
問題 1: ________________________________
解決方案: ______________________________

問題 2: ________________________________
解決方案: ______________________________
```

## 📋 快速驗證腳本

一鍵執行所有檢查：

```bash
#!/bin/bash
echo "🔍 開始驗收檢查..."

# 1. 檢查 CLAUDE.md
echo -n "CLAUDE.md 雜湊: "
sha256sum .policy/CLAUDE.md | awk '{print $1}'

# 2. 檢查分支
echo -e "\n📌 RED 分支:"
git branch -a | grep p1-red || echo "未找到 RED 分支"

echo -e "\n📌 GREEN 分支:"
git branch -a | grep p1-green || echo "未找到 GREEN 分支"

# 3. 檢查測試
echo -e "\n🧪 測試狀態:"
npm test --silent 2>&1 | tail -5

# 4. 檢查 PR
echo -e "\n🐙 Pull Requests:"
gh pr list --limit 5 2>/dev/null || echo "GitHub CLI 未設定"

# 5. 檢查報告
echo -e "\n📊 報告檔案:"
ls -la REPORT.md 2>/dev/null || echo "REPORT.md 不存在"

echo -e "\n✅ 驗收檢查完成!"
```

---

## 驗收結果

- [ ] **通過** - 所有項目皆符合預期
- [ ] **部分通過** - 有小問題但不影響主要功能
- [ ] **失敗** - 需要人工介入修正

**簽核**: ________________
**日期**: ________________

---

💡 **提示**: 將此檔案列印出來或在手機上開啟，逐項勾選確認。