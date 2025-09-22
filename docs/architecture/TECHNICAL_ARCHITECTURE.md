# 新竹市政府安心守護系統 - 技術架構文檔

## 📋 目錄
1. [系統概述](#系統概述)
2. [技術架構圖](#技術架構圖)
3. [系統工作流程](#系統工作流程)
4. [核心功能流程圖](#核心功能流程圖)
5. [技術棧詳細說明](#技術棧詳細說明)
6. [部署架構](#部署架構)
7. [資料流程設計](#資料流程設計)
8. [安全架構](#安全架構)

## 🎯 系統概述

新竹市政府安心守護系統是一個專為失智症患者及其家屬設計的智能定位守護平台。系統結合了行動應用程式、即時定位追蹤、地理圍欄警報、緊急求救等功能，提供全方位的安全守護服務。

### 主要特色
- **即時定位追蹤**: 透過GPS和BLE信標雙重定位
- **智能預測系統**: 颱風路徑式機率預測患者移動軌跡
- **緊急求救機制**: 一鍵SOS快速通知緊急聯絡人
- **地理圍欄監控**: 自動偵測離開安全區域並發送警報
- **多角色權限管理**: 支援家屬、志工、管理員等不同角色

## 🏗️ 技術架構圖

```mermaid
graph TB
    subgraph "前端層 Frontend Layer"
        A[React Native Mobile App<br/>v0.81.4]
        B[Admin Web Portal<br/>React]
    end

    subgraph "API Gateway"
        C[Nginx Reverse Proxy<br/>Load Balancer]
    end

    subgraph "應用層 Application Layer"
        D[Node.js Express API<br/>Port 3000/3001]
        E[WebSocket Server<br/>Real-time Updates]
        F[Firebase Admin SDK<br/>Push Notifications]
    end

    subgraph "資料層 Data Layer"
        G[(PostgreSQL 15<br/>Main Database)]
        H[(Redis Cache<br/>Session Store)]
        I[Firebase Cloud<br/>Messaging]
    end

    subgraph "外部服務 External Services"
        J[OpenStreetMap<br/>Leaflet Maps]
        K[BLE Beacons<br/>Indoor Positioning]
    end

    A --> C
    B --> C
    C --> D
    C --> E
    D --> F
    D --> G
    D --> H
    F --> I
    A --> J
    A --> K

    style A fill:#e1f5fe
    style B fill:#e1f5fe
    style C fill:#fff3e0
    style D fill:#e8f5e9
    style E fill:#e8f5e9
    style F fill:#e8f5e9
    style G fill:#fce4ec
    style H fill:#fce4ec
    style I fill:#f3e5f5
```

## 📊 系統工作流程

### 1. 用戶認證流程 (Authentication Workflow)

```mermaid
sequenceDiagram
    participant User as 用戶
    participant App as Mobile App
    participant API as Backend API
    participant DB as PostgreSQL
    participant Firebase as Firebase Auth

    User->>App: 輸入帳號密碼
    App->>API: POST /api/auth/login
    API->>DB: 查詢用戶資料
    DB-->>API: 返回用戶資訊
    API->>API: 驗證密碼 (bcrypt)
    API->>API: 生成 JWT Token
    API->>Firebase: 更新 FCM Token
    API-->>App: 返回 Token + 用戶資料
    App->>App: 存儲 Token (AsyncStorage)
    App-->>User: 登入成功
```

### 2. 即時定位追蹤流程 (Real-time Location Tracking)

```mermaid
sequenceDiagram
    participant Device as 行動裝置
    participant App as Mobile App
    participant WS as WebSocket
    participant API as Backend API
    participant DB as Database
    participant Guardian as 監護人裝置

    Device->>App: GPS定位更新
    App->>WS: 發送位置資料
    WS->>API: 處理位置更新
    API->>DB: 儲存位置記錄
    API->>API: 檢查地理圍欄
    alt 超出圍欄範圍
        API->>DB: 建立警報記錄
        API->>WS: 發送警報
        WS->>Guardian: 推送警報通知
    end
    API->>WS: 廣播位置更新
    WS->>Guardian: 即時位置更新
```

### 3. 緊急求救流程 (Emergency SOS)

```mermaid
flowchart LR
    A[用戶按下SOS] --> B[獲取當前位置]
    B --> C[發送緊急請求]
    C --> D{驗證請求}
    D -->|有效| E[建立緊急警報]
    D -->|無效| F[返回錯誤]
    E --> G[查詢緊急聯絡人]
    G --> H[發送推送通知]
    G --> I[發送SMS簡訊]
    H --> J[記錄事件日誌]
    I --> J
    J --> K[返回成功狀態]
```

## 🔄 核心功能流程圖

### A. 患者管理系統流程

```mermaid
graph TD
    Start([開始]) --> Login[用戶登入]
    Login --> Dashboard[進入主控台]
    Dashboard --> Choice{選擇操作}

    Choice -->|新增患者| AddPatient[填寫患者資料]
    AddPatient --> BindDevice[綁定追蹤設備]
    BindDevice --> SavePatient[儲存至資料庫]

    Choice -->|查看患者| ViewPatient[患者列表]
    ViewPatient --> SelectPatient[選擇患者]
    SelectPatient --> PatientDetail[顯示詳細資訊]

    Choice -->|追蹤位置| TrackLocation[開啟地圖]
    TrackLocation --> RealTimeUpdate[即時位置更新]
    RealTimeUpdate --> ShowPath[顯示移動軌跡]

    SavePatient --> End([結束])
    PatientDetail --> End
    ShowPath --> End
```

### B. 智能預測系統流程

```mermaid
graph TD
    Start([開始]) --> Collect[收集歷史位置資料]
    Collect --> Analyze[分析移動模式]
    Analyze --> Pattern{識別模式類型}

    Pattern -->|規律路線| Regular[建立規律模型]
    Pattern -->|隨機移動| Random[建立隨機模型]
    Pattern -->|異常行為| Anomaly[標記異常]

    Regular --> Predict[生成預測路徑]
    Random --> Predict
    Anomaly --> Alert[發送警報]

    Predict --> Probability[計算機率分布]
    Probability --> Visualize[視覺化顯示]

    Visualize --> Green[綠色: 高機率 >70%]
    Visualize --> Yellow[黃色: 中機率 40-70%]
    Visualize --> Orange[橙色: 低機率 <40%]

    Green --> Update[持續更新預測]
    Yellow --> Update
    Orange --> Update
    Alert --> Update

    Update --> End([結束])
```

### C. 地理圍欄監控流程

```mermaid
stateDiagram-v2
    [*] --> 設定圍欄
    設定圍欄 --> 監控中: 啟動監控

    監控中 --> 位置更新: 接收GPS訊號
    位置更新 --> 範圍檢查: 計算距離

    範圍檢查 --> 安全範圍: 在圍欄內
    範圍檢查 --> 離開圍欄: 超出範圍

    安全範圍 --> 監控中: 繼續監控

    離開圍欄 --> 觸發警報
    觸發警報 --> 發送通知
    發送通知 --> 記錄事件
    記錄事件 --> 監控中: 繼續監控

    監控中 --> [*]: 停止監控
```

## 💻 技術棧詳細說明

### 前端技術 (Frontend)

| 技術 | 版本 | 用途 |
|-----|------|-----|
| React Native | 0.81.4 | 跨平台行動應用開發 |
| TypeScript | 5.8.3 | 型別安全的 JavaScript |
| React Navigation | 7.x | 應用程式導航管理 |
| AsyncStorage | 2.2.0 | 本地資料存儲 |
| Firebase Messaging | 23.3.1 | 推送通知服務 |
| React Native Maps | 1.26.6 | Google 地圖整合 |
| Leaflet (WebView) | - | OpenStreetMap 地圖 |
| BLE PLX | 3.5.0 | 藍牙低功耗掃描 |

### 後端技術 (Backend)

| 技術 | 版本 | 用途 |
|-----|------|-----|
| Node.js | 20.x | JavaScript 執行環境 |
| Express | 5.1.0 | Web 應用框架 |
| PostgreSQL | 15 | 主要資料庫 |
| Redis | 7-alpine | 快取與會話管理 |
| WebSocket (ws) | 8.18.3 | 即時雙向通訊 |
| JWT | 9.0.2 | 身份驗證令牌 |
| bcryptjs | 3.0.2 | 密碼加密 |
| Firebase Admin | 13.5.0 | 伺服器端 Firebase SDK |

### DevOps & 部署

| 技術 | 用途 |
|-----|-----|
| Docker | 容器化部署 |
| Docker Compose | 多容器編排 |
| Nginx | 反向代理與負載平衡 |
| GitHub Actions | CI/CD 自動化 |
| Jest | 單元測試框架 |

## 🚀 部署架構

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Docker Network"
            NGINX[Nginx Container<br/>:80/:443]
            BACKEND[Backend Container<br/>:3000/:3001]
            POSTGRES[(PostgreSQL Container<br/>:5432)]
            REDIS[(Redis Container<br/>:6379)]
        end

        subgraph "Host System"
            VOLUMES[Docker Volumes<br/>postgres_data]
            CONFIGS[Configuration Files<br/>nginx.conf, .env]
        end
    end

    subgraph "External Access"
        DOMAIN[hsinchu.dpdns.org]
        IP[147.251.115.54]
    end

    DOMAIN --> NGINX
    IP --> NGINX
    NGINX --> BACKEND
    BACKEND --> POSTGRES
    BACKEND --> REDIS
    VOLUMES -.-> POSTGRES
    CONFIGS -.-> NGINX
    CONFIGS -.-> BACKEND
```

### 容器配置說明

1. **Nginx 容器**
   - 處理所有外部請求
   - SSL/TLS 終止 (預留)
   - 靜態檔案服務
   - API 請求代理

2. **Backend 容器**
   - Express API 服務 (Port 3000)
   - Admin API 服務 (Port 3001)
   - WebSocket 服務
   - Firebase 整合

3. **PostgreSQL 容器**
   - 主資料庫服務
   - 資料持久化 (Docker Volume)
   - 自動初始化腳本

4. **Redis 容器**
   - 會話存儲
   - 快取層
   - 即時資料暫存

## 📡 資料流程設計

### 資料庫架構 (ERD)

```mermaid
erDiagram
    USERS ||--o{ PATIENTS : manages
    USERS ||--o{ EMERGENCY_CONTACTS : has
    PATIENTS ||--o{ LOCATIONS : tracks
    PATIENTS ||--o{ GEOFENCES : sets
    PATIENTS ||--o{ ALERTS : generates
    PATIENTS ||--|| DEVICES : uses

    USERS {
        int id PK
        string firebase_uid UK
        string email UK
        string password_hash
        string name
        string role
        string fcm_token
        timestamp created_at
        timestamp last_login
    }

    PATIENTS {
        int id PK
        string name
        int age
        string address
        int guardian_id FK
        string emergency_contact
        string beacon_id
        timestamp created_at
    }

    LOCATIONS {
        int id PK
        int patient_id FK
        decimal latitude
        decimal longitude
        int accuracy
        int battery_level
        timestamp timestamp
    }

    GEOFENCES {
        int id PK
        int patient_id FK
        string name
        decimal center_lat
        decimal center_lng
        int radius
        boolean is_active
        timestamp created_at
    }

    ALERTS {
        int id PK
        int patient_id FK
        string type
        string message
        json location
        string status
        timestamp created_at
    }

    DEVICES {
        int id PK
        string serial_number UK
        string manufacturer
        string model
        int battery_level
        string ble_address
        int user_id FK
    }
```

## 🔐 安全架構

### 安全層級設計

```mermaid
graph TD
    subgraph "安全層級"
        L1[網路層安全]
        L2[應用層安全]
        L3[資料層安全]
        L4[存取控制]
    end

    L1 --> N1[HTTPS/TLS]
    L1 --> N2[防火牆規則]
    L1 --> N3[DDoS 防護]

    L2 --> A1[JWT 認證]
    L2 --> A2[API 限流]
    L2 --> A3[輸入驗證]

    L3 --> D1[密碼加密 bcrypt]
    L3 --> D2[資料庫加密]
    L3 --> D3[備份加密]

    L4 --> AC1[角色權限 RBAC]
    L4 --> AC2[API 權限控制]
    L4 --> AC3[資源隔離]
```

### 認證與授權流程

1. **認證 (Authentication)**
   - 用戶登入驗證
   - JWT Token 生成 (7天有效期)
   - Token 刷新機制

2. **授權 (Authorization)**
   - 角色基礎存取控制 (RBAC)
   - API 端點權限驗證
   - 資源級別權限控制

3. **資料保護**
   - 密碼: bcrypt 加鹽雜湊
   - 傳輸: HTTPS 加密 (預留)
   - 存儲: 敏感資料加密

## 📈 系統監控與維運

### 監控指標

- **效能監控**
  - API 回應時間
  - 資料庫查詢效能
  - WebSocket 連線數

- **可用性監控**
  - 服務健康檢查
  - 錯誤率追蹤
  - 系統資源使用率

- **安全監控**
  - 異常登入偵測
  - API 存取日誌
  - 錯誤事件記錄

### CI/CD 流程

```mermaid
graph LR
    Dev[開發] --> Git[Git Push]
    Git --> GHA[GitHub Actions]
    GHA --> Test[自動測試]
    Test --> Build[建置映像]
    Build --> Deploy[部署]
    Deploy --> Prod[生產環境]

    Test --> Report[測試報告]
    Build --> Registry[Docker Registry]
    Deploy --> Monitor[監控告警]
```

## 📝 總結

新竹市政府安心守護系統採用現代化的技術架構，結合了行動應用開發、即時通訊、地理定位、容器化部署等技術，提供了一個完整的失智症患者守護解決方案。系統具有高可用性、可擴展性和安全性，能夠有效地服務於目標用戶群體。

### 關鍵優勢
- ✅ 跨平台支援 (iOS/Android)
- ✅ 即時位置追蹤與預測
- ✅ 完整的緊急應變機制
- ✅ 容器化部署易於維護
- ✅ 模組化架構易於擴展

### 未來發展方向
- 🔄 整合 AI 行為分析
- 🔄 擴展 IoT 設備支援
- 🔄 強化機器學習預測模型
- 🔄 提升系統可擴展性

---
*文檔版本: v1.0.0*
*最後更新: 2025-01-21*
*專案版本: v2.0.0 (Backend) / v1.6.9 (Mobile)*