# 後端設置指令 - 在 tmux backend-setup session 中執行

請在 claude --dangerously-skip-permissions 環境中執行以下任務：

## 1. 安裝 PostgreSQL 資料庫
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## 2. 設置資料庫
```bash
sudo -u postgres psql << EOF
CREATE DATABASE hsinchu_guardian;
CREATE USER guardian_user WITH PASSWORD 'guardian2025';
GRANT ALL PRIVILEGES ON DATABASE hsinchu_guardian TO guardian_user;
\q
EOF
```

## 3. 創建資料表
```bash
sudo -u postgres psql -d hsinchu_guardian << 'EOF'
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    fcm_token TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INTEGER,
    address TEXT,
    guardian_id INTEGER REFERENCES users(id),
    emergency_contact VARCHAR(20),
    beacon_id VARCHAR(50),
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Locations table
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    battery_level INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Geofences table
CREATE TABLE geofences (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    name VARCHAR(100) NOT NULL,
    center_lat DECIMAL(10, 8) NOT NULL,
    center_lng DECIMAL(11, 8) NOT NULL,
    radius INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    type VARCHAR(50) NOT NULL,
    message TEXT,
    location JSONB,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Beacon status table
CREATE TABLE beacon_status (
    beacon_id VARCHAR(50) PRIMARY KEY,
    rssi INTEGER,
    battery INTEGER,
    last_seen TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_locations_patient_time ON locations(patient_id, timestamp DESC);
CREATE INDEX idx_alerts_patient ON alerts(patient_id);
CREATE INDEX idx_patients_guardian ON patients(guardian_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO guardian_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO guardian_user;
EOF
```

## 4. 安裝 Node.js 依賴套件
```bash
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend
npm init -y
npm install express cors body-parser firebase-admin jsonwebtoken bcryptjs pg ws dotenv
npm install -D nodemon @types/node
```

## 5. 創建環境變數檔案
```bash
cat > /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend/.env << EOF
PORT=3000
DATABASE_URL=postgresql://guardian_user:guardian2025@localhost:5432/hsinchu_guardian
JWT_SECRET=hsinchu-guardian-secret-2025
NODE_ENV=production
PUBLIC_IP=147.251.115.54
EOF
```

## 6. 創建 Docker 設定
```bash
# Dockerfile
cat > /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
EOF

# docker-compose.yml
cat > /home/ubuntu/dev/hccg-hsinchu-pass-guardian/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: hsinchu_guardian
      POSTGRES_USER: guardian_user
      POSTGRES_PASSWORD: guardian2025
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - guardian_network

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://guardian_user:guardian2025@postgres:5432/hsinchu_guardian
      - JWT_SECRET=hsinchu-guardian-secret-2025
      - NODE_ENV=production
    depends_on:
      - postgres
    volumes:
      - ./config:/app/config
    networks:
      - guardian_network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  guardian_network:
    driver: bridge
EOF
```

## 7. 創建 PM2 設定（生產環境）
```bash
cat > /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'hsinchu-guardian-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
```

## 8. 啟動服務（選擇一種方式）

### 方式 A: 使用 Docker Compose（推薦）
```bash
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian
docker-compose up -d
```

### 方式 B: 使用 PM2
```bash
sudo npm install -g pm2
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 方式 C: 直接執行（開發測試）
```bash
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend
node server.js
```

## 9. 設定防火牆
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5432/tcp
sudo ufw reload
```

## 10. 測試 API
```bash
# 測試健康檢查
curl http://147.251.115.54:3000/health

# 測試註冊
curl -X POST http://147.251.115.54:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "測試用戶",
    "role": "family",
    "phone": "0912345678"
  }'
```

---

執行完成後，後端服務將在以下位址可用：
- API: http://147.251.115.54:3000
- WebSocket: ws://147.251.115.54:3000

請在 tmux backend-setup session 中執行這些指令。