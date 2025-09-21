# 🛡️ 新竹市政府安心守護系統
# Hsinchu City Government Pass Guardian System

<div align="center">

[![Version](https://img.shields.io/badge/version-v2.0.0-blue.svg)](https://github.com/hccg/hsinchu-pass-guardian)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](package.json)
[![React Native](https://img.shields.io/badge/react--native-0.81.4-61dafb.svg)](mobile/HsinchuPassGuardian/package.json)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](docker-compose.yml)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF.svg)](.github/workflows)

**專為失智症患者及其家屬設計的智能定位守護平台**

[功能特色](#-功能特色) • [快速開始](#-快速開始) • [系統架構](#-系統架構) • [API文檔](#-api-文檔) • [部署指南](#-部署指南)

</div>

---

## 📋 目錄

- [專案簡介](#-專案簡介)
- [功能特色](#-功能特色)
- [技術架構](#-技術架構)
- [快速開始](#-快速開始)
- [專案結構](#-專案結構)
- [API 文檔](#-api-文檔)
- [部署指南](#-部署指南)
- [開發指南](#-開發指南)
- [測試](#-測試)
- [版本歷程](#-版本歷程)
- [貢獻指南](#-貢獻指南)
- [授權條款](#-授權條款)

## 🎯 專案簡介

新竹市政府安心守護系統是一個創新的智能守護平台，專門為失智症患者、年長者及其家屬提供全方位的安全守護服務。透過結合 GPS 定位、BLE 信標、地理圍欄、智能預測等先進技術，為需要特殊照護的族群提供即時、精準的位置追蹤與緊急援助功能。

### 核心價值

- **即時守護** - 24/7 全天候位置監控與異常偵測
- **智能預測** - AI 驅動的移動路徑預測與風險評估
- **快速應變** - 一鍵緊急求救與自動警報系統
- **社區互助** - 連結家屬、志工與醫療資源

## ✨ 功能特色

### 🗺️ 即時定位追蹤
- GPS + BLE 雙重定位技術
- 室內外無縫切換
- 歷史軌跡回放
- 即時位置分享

### 🌀 颱風路徑式機率預測
- **v1.6.9 最新功能**
- 動態機率算法預測患者移動路徑
- 視覺化機率分布（綠色>70%、黃色40-70%、橙色<40%）
- 即時更新預測模型

### 🚨 緊急求救系統
- 一鍵 SOS 求救
- 自動通知緊急聯絡人
- 位置資訊即時傳送
- 多通道警報（推送通知、SMS、電話）

### 🎯 地理圍欄監控
- 自訂安全區域
- 離開/進入自動警報
- 多重圍欄設定
- 智能提醒功能

### 📱 跨平台支援
- iOS / Android 原生應用
- Web 管理後台
- 響應式設計
- 離線模式支援

### 👥 多角色權限管理
- 家屬監護人
- 社區志工
- 醫護人員
- 系統管理員

## 🏗️ 技術架構

### 技術棧

<table>
<tr>
<td width="50%">

#### 前端技術
- **Mobile App**
  - React Native 0.81.4
  - TypeScript 5.8.3
  - React Navigation 7.x
  - Firebase Messaging
  - Leaflet Maps (WebView)
  - BLE PLX 3.5.0

</td>
<td width="50%">

#### 後端技術
- **Server & API**
  - Node.js 20.x
  - Express 5.1.0
  - PostgreSQL 15
  - Redis 7-alpine
  - WebSocket (ws 8.18.3)
  - JWT Authentication

</td>
</tr>
<tr>
<td width="50%">

#### DevOps & 部署
- Docker & Docker Compose
- Nginx (反向代理)
- GitHub Actions (CI/CD)
- PM2 (程序管理)

</td>
<td width="50%">

#### 外部服務
- Firebase Cloud Messaging
- OpenStreetMap
- SMS Gateway (預留)
- Email Service (預留)

</td>
</tr>
</table>

### 系統架構圖

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │     │   Admin     │     │   External  │
│     App     │────▶│   Portal    │────▶│   Services  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                     │
       ▼                   ▼                     ▼
┌───────────────────────────────────────────────────┐
│              Nginx Reverse Proxy                  │
│                  (Port 80/443)                    │
└───────────────────────────────────────────────────┘
                         │
       ┌─────────────────┴─────────────────┐
       ▼                                   ▼
┌──────────────┐                  ┌──────────────┐
│  Express API │                  │  WebSocket   │
│  Port 3000   │◀────────────────▶│    Server    │
└──────────────┘                  └──────────────┘
       │                                   │
       ▼                                   ▼
┌──────────────┐     ┌────────┐   ┌──────────────┐
│  PostgreSQL  │────▶│ Redis  │◀──│   Firebase   │
│   Database   │     │ Cache  │   │     Admin    │
└──────────────┘     └────────┘   └──────────────┘
```

## 🚀 快速開始

### 環境需求

- Node.js >= 20.0.0
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7
- Android Studio / Xcode (開發用)

### 安裝步驟

#### 1. Clone 專案

```bash
git clone https://github.com/your-org/hccg-hsinchu-pass-guardian.git
cd hccg-hsinchu-pass-guardian
```

#### 2. 後端設定

```bash
# 安裝相依套件
cd backend
npm install

# 設定環境變數
cp .env.example .env
# 編輯 .env 檔案，設定資料庫連線等資訊

# 啟動 Docker 服務
cd ..
docker-compose up -d

# 初始化資料庫
docker exec -i hccg-postgres psql -U hccg -d hccg_development < init.sql

# 啟動後端服務
cd backend
npm start
```

#### 3. Mobile App 設定

```bash
# 安裝相依套件
cd mobile/HsinchuPassGuardian
npm install

# iOS (僅 macOS)
cd ios && pod install
cd ..
npm run ios

# Android
npm run android
```

#### 4. 快速測試登入

**測試帳號：**
```
Email: test@example.com
密碼: Test123456
```

或使用 App 中的「🚀 快速測試登入」按鈕

## 📁 專案結構

```
hccg-hsinchu-pass-guardian/
├── 📱 mobile/                    # React Native 行動應用
│   └── HsinchuPassGuardian/
│       ├── src/
│       │   ├── screens/         # 18個畫面組件
│       │   ├── components/      # 可重用組件
│       │   ├── services/        # API 服務層
│       │   └── utils/           # 工具函數
│       ├── android/             # Android 原生程式碼
│       ├── ios/                 # iOS 原生程式碼
│       └── package.json
│
├── 🖥️ backend/                   # Node.js 後端服務
│   ├── routes/                  # API 路由
│   │   ├── emergency.js         # 緊急功能
│   │   ├── geofence.js          # 地理圍欄
│   │   ├── simulation.js        # 模擬功能
│   │   └── notifications.js     # 通知服務
│   ├── services/                # 商業邏輯
│   ├── tests/                   # 測試檔案
│   └── server.js                # 主程式進入點
│
├── 🎨 admin/                     # 管理後台 (Web)
│   └── index.html
│
├── 🐳 Docker 相關
│   ├── docker-compose.yml       # Docker 編排設定
│   ├── Dockerfile              # 應用程式映像
│   └── nginx.conf              # Nginx 設定
│
├── 🔧 設定檔案
│   ├── .env.example            # 環境變數範本
│   ├── init.sql                # 資料庫初始化
│   └── ecosystem.config.js     # PM2 設定
│
├── 📋 GitHub Actions
│   └── .github/workflows/       # 15個 CI/CD 工作流程
│
└── 📚 文檔
    ├── README.md               # 本文件
    ├── TECHNICAL_ARCHITECTURE.md # 技術架構詳述
    ├── RELEASE_NOTES.md        # 版本發布紀錄
    └── LOGIN_INFO.md           # 登入資訊說明
```

## 📡 API 文檔

### 基礎資訊
- **Base URL**: `http://hsinchu.dpdns.org:3001/api`
- **認證方式**: JWT Bearer Token
- **Content-Type**: `application/json`

### 主要端點

#### 認證相關
| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/auth/register` | 用戶註冊 |
| POST | `/auth/login` | 用戶登入 |
| POST | `/auth/refresh` | 更新 Token |
| POST | `/auth/logout` | 登出 |

#### 患者管理
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/patients` | 獲取患者列表 |
| POST | `/patients` | 新增患者 |
| GET | `/patients/:id` | 獲取患者詳情 |
| PUT | `/patients/:id` | 更新患者資料 |
| DELETE | `/patients/:id` | 刪除患者 |

#### 位置追蹤
| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/locations` | 更新位置 |
| GET | `/locations/:patientId/history` | 位置歷史 |
| GET | `/locations/:patientId/current` | 當前位置 |

#### 緊急功能
| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/emergency/sos` | 發送 SOS |
| POST | `/emergency/cancel/:alertId` | 取消警報 |
| GET | `/emergency/history` | 緊急歷史 |
| GET | `/emergency/contacts` | 緊急聯絡人 |

#### 地理圍欄
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/geofences` | 圍欄列表 |
| POST | `/geofences` | 建立圍欄 |
| PUT | `/geofences/:id` | 更新圍欄 |
| DELETE | `/geofences/:id` | 刪除圍欄 |

### WebSocket 事件

連線 URL: `ws://hsinchu.dpdns.org:3001`

#### 事件類型
- `auth` - 身份驗證
- `location_update` - 位置更新
- `emergency_alert` - 緊急警報
- `geofence_breach` - 圍欄警報

## 🚢 部署指南

### Docker 部署（推薦）

```bash
# 建置並啟動所有服務
docker-compose up -d

# 檢視服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down
```

### 手動部署

```bash
# 1. 安裝 PostgreSQL 和 Redis
sudo apt-get install postgresql redis-server

# 2. 設定資料庫
psql -U postgres -c "CREATE DATABASE hsinchu_guardian;"
psql -U postgres -d hsinchu_guardian < init.sql

# 3. 啟動後端服務
cd backend
npm install
npm start

# 4. 設定 Nginx
sudo cp nginx.conf /etc/nginx/sites-available/hsinchu-guardian
sudo ln -s /etc/nginx/sites-available/hsinchu-guardian /etc/nginx/sites-enabled/
sudo nginx -s reload
```

### 環境變數設定

```env
# 資料庫設定
DATABASE_URL=postgresql://guardian_user:guardian2025@localhost:5432/hsinchu_guardian

# JWT 設定
JWT_SECRET=hsinchu-guardian-secret-2025

# 服務端口
PORT=3000
ADMIN_PORT=3001

# Firebase 設定
FIREBASE_PROJECT_ID=hccg-hsinchu-pass-guardian
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# 公開 IP
PUBLIC_IP=147.251.115.54
```

## 🛠️ 開發指南

### 本地開發環境

```bash
# 啟動開發環境
npm run dev

# 程式碼檢查
npm run lint

# 型別檢查
npm run typecheck

# 格式化程式碼
npm run format
```

### 分支管理

- `main` - 生產環境分支
- `develop` - 開發分支
- `feature/*` - 功能開發
- `hotfix/*` - 緊急修復
- `release/*` - 發布準備

### Commit 規範

使用 [Conventional Commits](https://www.conventionalcommits.org/)

```
feat: 新增患者匯入功能
fix: 修復地理圍欄計算錯誤
docs: 更新 API 文檔
style: 程式碼格式調整
refactor: 重構定位服務
test: 新增單元測試
chore: 更新相依套件
```

## 🧪 測試

### 執行測試

```bash
# 後端測試
cd backend
npm test

# 測試覆蓋率
npm run test:coverage

# Mobile App 測試
cd mobile/HsinchuPassGuardian
npm test

# E2E 測試
npm run test:e2e
```

### 測試覆蓋率要求

- 單元測試: >= 90%
- 整合測試: >= 80%
- E2E 測試: 主要流程 100%

## 📈 版本歷程

### v2.0.0 (2025-01-21)
- 🎯 專案架構全面升級
- 🐳 Docker 容器化部署
- 📡 WebSocket 即時通訊
- 🔐 JWT 認證機制

### v1.6.9 (2025-01-20)
- 🌀 颱風路徑式機率預測系統
- 📊 動態機率算法
- 🎨 視覺化機率分布

### v1.6.8 (2025-01-20)
- ✅ 完整實裝即時定位模擬
- 🗺️ Leaflet Map 整合
- 📈 機率熱像圖顯示

### v1.6.6 (2025-01-20)
- 🚨 修復緊急求救功能
- 📱 快速測試登入按鈕
- 🔧 API 端點修正

[查看完整版本紀錄](RELEASE_NOTES.md)

## 🤝 貢獻指南

我們歡迎所有形式的貢獻！請參閱以下指南：

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 貢獻者行為準則

- 尊重所有參與者
- 接受建設性批評
- 專注於對社群最有益的事
- 展現同理心

## 📄 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 📞 聯絡資訊

- **專案負責人**: 新竹市政府資訊科
- **技術支援**: support@hsinchu.gov.tw
- **緊急聯絡**: +886-3-521-6121
- **官方網站**: [新竹市政府](https://www.hccg.gov.tw)

## 🙏 致謝

感謝所有為本專案貢獻的開發者、測試人員、使用者，以及新竹市政府的支持。

特別感謝：
- 新竹市社會處
- 新竹市衛生局
- 失智症關懷協會
- 社區志工團隊

---

<div align="center">

**打造更安全、更溫暖的智慧城市**

Made with ❤️ by Hsinchu City Government

© 2025 新竹市政府 版權所有

</div>