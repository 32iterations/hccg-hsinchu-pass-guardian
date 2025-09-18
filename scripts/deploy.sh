#!/bin/bash

# 新竹安心守護系統部署腳本

set -e

echo "🚀 開始部署新竹安心守護系統..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查必要工具
check_requirements() {
    echo "📋 檢查系統需求..."

    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安裝${NC}"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安裝${NC}"
        exit 1
    fi

    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}⚠️  PM2 未安裝，正在安裝...${NC}"
        npm install -g pm2
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}⚠️  Docker 未安裝${NC}"
    fi

    echo -e "${GREEN}✅ 系統需求檢查完成${NC}"
}

# 安裝依賴
install_dependencies() {
    echo "📦 安裝依賴套件..."

    # 主專案依賴
    npm install

    # 後端依賴
    cd backend
    npm install
    cd ..

    echo -e "${GREEN}✅ 依賴安裝完成${NC}"
}

# 設置環境變數
setup_environment() {
    echo "🔧 設置環境變數..."

    if [ ! -f .env ]; then
        cat > .env << EOF
NODE_ENV=production
PORT=3000
ADMIN_PORT=3001
PUBLIC_IP=147.251.115.54
JWT_SECRET=hsinchu-guardian-secret-$(date +%s)
EOF
        echo -e "${GREEN}✅ 環境變數檔案已建立${NC}"
    else
        echo -e "${YELLOW}⚠️  環境變數檔案已存在${NC}"
    fi
}

# 建立必要目錄
create_directories() {
    echo "📁 建立必要目錄..."

    mkdir -p logs
    mkdir -p ssl
    mkdir -p uploads

    echo -e "${GREEN}✅ 目錄建立完成${NC}"
}

# PM2 部署
deploy_with_pm2() {
    echo "🔄 使用 PM2 部署應用..."

    # 停止現有服務
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true

    # 啟動服務
    pm2 start ecosystem.config.js --env production

    # 儲存 PM2 配置
    pm2 save

    # 設置開機自動啟動
    pm2 startup systemd -u $USER --hp /home/$USER

    echo -e "${GREEN}✅ PM2 部署完成${NC}"
}

# Docker 部署
deploy_with_docker() {
    echo "🐳 使用 Docker 部署..."

    if command -v docker &> /dev/null; then
        # 停止現有容器
        docker-compose down 2>/dev/null || true

        # 建構並啟動容器
        docker-compose up -d --build

        echo -e "${GREEN}✅ Docker 部署完成${NC}"
    else
        echo -e "${YELLOW}⚠️  跳過 Docker 部署（Docker 未安裝）${NC}"
    fi
}

# 健康檢查
health_check() {
    echo "🏥 執行健康檢查..."

    sleep 5

    # 檢查管理介面
    if curl -s http://localhost:3001/health > /dev/null; then
        echo -e "${GREEN}✅ 管理介面運行正常${NC}"
    else
        echo -e "${RED}❌ 管理介面無回應${NC}"
    fi

    # 檢查 API 服務
    if curl -s http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✅ API 服務運行正常${NC}"
    else
        echo -e "${RED}❌ API 服務無回應${NC}"
    fi
}

# 顯示服務資訊
show_info() {
    echo ""
    echo "======================================"
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo "======================================"
    echo ""
    echo "📡 服務訪問資訊："
    echo "  管理介面: http://147.251.115.54:3001/admin"
    echo "  API 服務: http://147.251.115.54:3000"
    echo ""
    echo "🔑 預設管理員帳號："
    echo "  Email: admin@hsinchu.gov.tw"
    echo "  Password: admin123"
    echo ""
    echo "📊 PM2 管理命令："
    echo "  查看狀態: pm2 status"
    echo "  查看日誌: pm2 logs"
    echo "  重啟服務: pm2 restart all"
    echo ""
    echo "======================================"
}

# 主程序
main() {
    check_requirements
    install_dependencies
    setup_environment
    create_directories

    # 選擇部署方式
    echo ""
    echo "請選擇部署方式："
    echo "1) PM2 (推薦)"
    echo "2) Docker"
    echo "3) 兩者都部署"
    read -p "選擇 (1-3): " choice

    case $choice in
        1)
            deploy_with_pm2
            ;;
        2)
            deploy_with_docker
            ;;
        3)
            deploy_with_pm2
            deploy_with_docker
            ;;
        *)
            echo -e "${RED}無效選擇${NC}"
            exit 1
            ;;
    esac

    health_check
    show_info
}

# 執行主程序
main