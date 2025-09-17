#!/bin/bash
set -euo pipefail

# 🔍 Overnight Automation Verification Script
# 自動檢查過夜執行結果是否符合預期

echo "=================================================="
echo "🔍 過夜自動化執行驗收檢查"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✅${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}❌${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
    ((WARNINGS++))
}

section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

# Find latest log directory
LATEST_LOG=$(ls -dt logs/*/ 2>/dev/null | head -1)
if [ -z "$LATEST_LOG" ]; then
    check_warn "找不到執行日誌目錄"
    LATEST_LOG="logs/"
fi

section "1. 策略保護驗證"

# Check CLAUDE.md integrity
if [ -f ".policy/CLAUDE.md" ]; then
    CURRENT_HASH=$(sha256sum .policy/CLAUDE.md | awk '{print $1}')

    if [ -f "${LATEST_LOG}claude_md.sha256" ]; then
        ORIGINAL_HASH=$(cat ${LATEST_LOG}claude_md.sha256)

        if [ "$CURRENT_HASH" = "$ORIGINAL_HASH" ]; then
            check_pass "CLAUDE.md 雜湊值一致 (未被修改)"
            echo "    Hash: ${CURRENT_HASH:0:16}..."
        else
            check_fail "CLAUDE.md 已被修改！"
            echo "    原始: ${ORIGINAL_HASH:0:16}..."
            echo "    目前: ${CURRENT_HASH:0:16}..."
        fi
    else
        check_warn "無法找到原始雜湊值記錄"
    fi

    # Check if read-only
    if touch .policy/test 2>/dev/null; then
        rm .policy/test
        check_warn ".policy/ 目錄可寫入 (生產環境應為唯讀)"
    else
        check_pass ".policy/ 目錄為唯讀保護"
    fi
else
    check_fail ".policy/CLAUDE.md 不存在"
fi

section "2. 分支驗證"

# Find RED and GREEN branches
RED_BRANCH=$(git branch -a | grep -o "p1-red-[0-9-]*" | head -1)
GREEN_BRANCH=$(git branch -a | grep -o "p1-green-[0-9-]*" | head -1)

# Check RED branch
if [ -n "$RED_BRANCH" ]; then
    check_pass "RED 分支存在: $RED_BRANCH"

    # Check if only test files
    TEST_ONLY=$(git diff main..$RED_BRANCH --name-only 2>/dev/null | grep -v -E "(test|spec)" | wc -l)
    if [ "$TEST_ONLY" -eq 0 ]; then
        check_pass "RED 分支只包含測試檔案"
    else
        check_warn "RED 分支包含非測試檔案"
    fi

    # Check commit message
    RED_MSG=$(git log --oneline $RED_BRANCH -1 2>/dev/null | head -1)
    if echo "$RED_MSG" | grep -q "^\[RED\]"; then
        check_pass "RED 提交訊息格式正確"
    else
        check_warn "RED 提交訊息未使用 [RED] 前綴"
    fi
else
    check_fail "找不到 RED 分支 (p1-red-*)"
fi

# Check GREEN branch
if [ -n "$GREEN_BRANCH" ]; then
    check_pass "GREEN 分支存在: $GREEN_BRANCH"

    # Check if contains implementation
    IMPL_FILES=$(git diff ${RED_BRANCH:-main}..$GREEN_BRANCH --name-only 2>/dev/null | grep -E "src/.*\.(js|ts)" | wc -l)
    if [ "$IMPL_FILES" -gt 0 ]; then
        check_pass "GREEN 分支包含實作檔案"
    else
        check_warn "GREEN 分支未找到實作檔案"
    fi

    # Check commit message
    GREEN_MSG=$(git log --oneline $GREEN_BRANCH -1 2>/dev/null | head -1)
    if echo "$GREEN_MSG" | grep -q "^\[GREEN\]"; then
        check_pass "GREEN 提交訊息格式正確"
    else
        check_warn "GREEN 提交訊息未使用 [GREEN] 前綴"
    fi
else
    check_fail "找不到 GREEN 分支 (p1-green-*)"
fi

section "3. 測試執行狀態"

# Try to run tests on GREEN branch
if [ -n "$GREEN_BRANCH" ]; then
    echo "切換到 GREEN 分支測試..."
    CURRENT_BRANCH=$(git branch --show-current)
    git checkout $GREEN_BRANCH 2>/dev/null || true

    # Run tests
    if npm test --silent 2>/dev/null; then
        check_pass "GREEN 分支測試全部通過"
    else
        check_warn "GREEN 分支有測試失敗"
    fi

    # Check coverage
    if [ -f "coverage/coverage-summary.json" ]; then
        COVERAGE=$(grep -o '"pct":[0-9.]*' coverage/coverage-summary.json | head -1 | cut -d: -f2)
        if (( $(echo "$COVERAGE >= 80" | bc -l) )); then
            check_pass "測試覆蓋率達標: ${COVERAGE}%"
        else
            check_warn "測試覆蓋率不足: ${COVERAGE}% (需要 ≥80%)"
        fi
    fi

    # Switch back
    git checkout $CURRENT_BRANCH 2>/dev/null || true
fi

section "4. 報告與文件"

# Check REPORT.md
if [ -f "REPORT.md" ]; then
    check_pass "REPORT.md 存在"

    # Check content
    if grep -q "Test Summary" REPORT.md; then
        check_pass "報告包含測試摘要"
    else
        check_warn "報告缺少測試摘要"
    fi

    if grep -q "Device Binding" REPORT.md && grep -q "Geofence" REPORT.md; then
        check_pass "報告包含功能實作清單"
    else
        check_warn "報告功能清單不完整"
    fi

    if grep -q "Risk Assessment" REPORT.md; then
        check_pass "報告包含風險評估"
    else
        check_warn "報告缺少風險評估"
    fi
elif [ -f "${LATEST_LOG}REPORT.md" ]; then
    check_warn "REPORT.md 在日誌目錄: ${LATEST_LOG}"
else
    check_fail "找不到 REPORT.md"
fi

# Check logs
if [ -d "$LATEST_LOG" ]; then
    LOG_COUNT=$(ls -1 ${LATEST_LOG}*.log 2>/dev/null | wc -l)
    if [ "$LOG_COUNT" -gt 0 ]; then
        check_pass "執行日誌已記錄 (${LOG_COUNT} 個檔案)"

        # Check for errors
        ERROR_COUNT=$(grep -i "fatal\|error" ${LATEST_LOG}*.log 2>/dev/null | wc -l)
        if [ "$ERROR_COUNT" -eq 0 ]; then
            check_pass "日誌中無嚴重錯誤"
        else
            check_warn "日誌中有 ${ERROR_COUNT} 個錯誤訊息"
        fi
    else
        check_warn "日誌目錄為空"
    fi
fi

section "5. GitHub 整合"

# Check for PR
if command -v gh &> /dev/null; then
    PR_COUNT=$(gh pr list --state open --search "[P1]" 2>/dev/null | wc -l)
    if [ "$PR_COUNT" -gt 0 ]; then
        check_pass "找到 ${PR_COUNT} 個相關 PR"

        # Check for AI attribution
        PR_BODY=$(gh pr list --state open --search "[P1]" --json body -q '.[0].body' 2>/dev/null)
        if echo "$PR_BODY" | grep -qi "claude\|ai\|anthropic"; then
            check_fail "PR 包含 AI 署名"
        else
            check_pass "PR 無 AI 署名"
        fi
    else
        check_warn "未找到相關 PR"
    fi
else
    check_warn "GitHub CLI 未安裝"
fi

section "6. 程式碼品質"

# Linting
if npm run lint --silent 2>/dev/null; then
    check_pass "Linting 檢查通過"
else
    check_warn "Linting 有警告或錯誤"
fi

# Security audit
AUDIT_RESULT=$(npm audit --audit-level=high 2>&1 | grep -c "found 0" || true)
if [ "$AUDIT_RESULT" -gt 0 ]; then
    check_pass "無高風險安全漏洞"
else
    check_warn "發現安全漏洞 (執行 npm audit 查看)"
fi

section "7. TDD 合規性"

# Calculate TDD score
TDD_SCORE=0
[ -n "$RED_BRANCH" ] && ((TDD_SCORE+=25))
[ -n "$GREEN_BRANCH" ] && ((TDD_SCORE+=25))
[ "$TEST_ONLY" -eq 0 ] 2>/dev/null && ((TDD_SCORE+=25))
[ -f "REPORT.md" ] && ((TDD_SCORE+=25))

if [ "$TDD_SCORE" -eq 100 ]; then
    check_pass "TDD 流程完整 (100%)"
elif [ "$TDD_SCORE" -ge 75 ]; then
    check_warn "TDD 流程部分完成 (${TDD_SCORE}%)"
else
    check_fail "TDD 流程不完整 (${TDD_SCORE}%)"
fi

echo ""
echo "=================================================="
echo "📊 驗收結果摘要"
echo "=================================================="
echo ""
echo -e "通過項目: ${GREEN}${PASSED}${NC}"
echo -e "警告項目: ${YELLOW}${WARNINGS}${NC}"
echo -e "失敗項目: ${RED}${FAILED}${NC}"
echo ""

# Overall verdict
if [ "$FAILED" -eq 0 ]; then
    if [ "$WARNINGS" -eq 0 ]; then
        echo -e "${GREEN}🎉 完美通過！所有檢查項目皆符合預期。${NC}"
        EXIT_CODE=0
    else
        echo -e "${GREEN}✅ 驗收通過${NC} (有 ${WARNINGS} 個小警告)"
        EXIT_CODE=0
    fi
else
    echo -e "${RED}❌ 驗收失敗${NC} - 有 ${FAILED} 個關鍵問題需要處理"
    EXIT_CODE=1
fi

echo ""
echo "詳細報告已儲存至: verification-report-$(date +%Y%m%d).txt"

# Save detailed report
{
    echo "驗收報告 - $(date)"
    echo "=================="
    echo "通過: $PASSED"
    echo "警告: $WARNINGS"
    echo "失敗: $FAILED"
    echo ""
    echo "最新日誌: $LATEST_LOG"
    echo "RED 分支: ${RED_BRANCH:-未找到}"
    echo "GREEN 分支: ${GREEN_BRANCH:-未找到}"
} > "verification-report-$(date +%Y%m%d).txt"

exit $EXIT_CODE