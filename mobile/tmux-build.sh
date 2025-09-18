#!/bin/bash

# Tmux 持久會話建置腳本
# 這會創建一個可以在背景運行的 tmux 會話

SESSION_NAME="hsinchu-app-build"
WORK_DIR="/home/ubuntu/dev/hccg-hsinchu-pass-guardian/mobile"

echo "🖥️  設定 tmux 持久會話..."

# 檢查 tmux 是否已安裝
if ! command -v tmux &> /dev/null; then
    echo "安裝 tmux..."
    sudo apt-get update && sudo apt-get install -y tmux
fi

# 如果會話已存在，先關閉它
tmux has-session -t $SESSION_NAME 2>/dev/null
if [ $? -eq 0 ]; then
    echo "關閉現有會話..."
    tmux kill-session -t $SESSION_NAME
fi

# 創建新的 tmux 會話
echo "創建新的 tmux 會話: $SESSION_NAME"
tmux new-session -d -s $SESSION_NAME -c $WORK_DIR

# 在會話中執行建置腳本
tmux send-keys -t $SESSION_NAME "./auto-build.sh" Enter

echo ""
echo "====================================="
echo "✅ Tmux 會話已創建並開始執行"
echo "====================================="
echo ""
echo "🔧 有用的 tmux 命令:"
echo ""
echo "  查看建置進度:"
echo "    tmux attach -t $SESSION_NAME"
echo ""
echo "  脫離會話 (保持運行):"
echo "    按 Ctrl+B 然後按 D"
echo ""
echo "  查看所有會話:"
echo "    tmux ls"
echo ""
echo "  查看建置日誌:"
echo "    tail -f $WORK_DIR/HsinchuPassGuardian/build-logs/build-*.log"
echo ""
echo "  停止建置:"
echo "    tmux kill-session -t $SESSION_NAME"
echo ""
echo "====================================="
echo "📱 APK 將會儲存在:"
echo "  $WORK_DIR/HsinchuPassGuardian/apk-output/"
echo "====================================="