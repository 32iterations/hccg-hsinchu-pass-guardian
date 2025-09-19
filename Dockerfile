# 新竹安心守護系統 Docker 映像檔
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# 複製 package.json 檔案
COPY package*.json ./
COPY backend/package*.json ./backend/

# 安裝依賴
RUN npm ci --only=production
RUN cd backend && npm ci --only=production

# 複製應用程式碼
COPY . .

# 設定環境變數
ENV NODE_ENV=production
ENV PUBLIC_IP=0.0.0.0

# 暴露端口
EXPOSE 3000 3001

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# 啟動應用 (同時運行主要API和管理服務)
CMD ["sh", "-c", "node backend/server.js & node backend/server-admin.js & wait"]