# 新竹安心守護系統 - 系統狀態報告
生成時間：2025-09-19 16:45 (UTC+8)

## 🚀 系統運行狀態

### ✅ 後端服務 (PM2管理)
| 服務名稱 | 狀態 | PID | 運行時間 | 記憶體 | 端口 |
|---------|------|-----|---------|--------|------|
| hccg-admin | 🟢 運行中 | 2492594 | 3分鐘 | 69.7MB | 3001 |
| hccg-backend-1 | 🟢 運行中 | 2425725 | 46分鐘 | 70.3MB | 3000 |
| hccg-backend-2 | 🟢 運行中 | 2425758 | 46分鐘 | 70.2MB | 3000 |

### ✅ Docker 容器服務
| 服務名稱 | 狀態 | 端口映射 |
|---------|------|---------|
| hccg-nginx | 🟢 健康運行 | 80, 443 |
| hccg-redis | 🟢 健康運行 | 6379 |
| hccg-postgres | 🟢 健康運行 | 5432 |

## 📱 應用程式版本

### Android APK
- **最新版本**: v1.3.1
- **版本代碼**: 5
- **發布日期**: 2025-09-19
- **下載連結**: [GitHub Release](https://github.com/32iterations/hccg-hsinchu-pass-guardian/releases/download/v1.3.1/app-release.apk)
- **主要更新**: 修正 Android 9+ HTTP 連線問題

## 🌐 API 端點

### 公開訪問連結
- **主要 API**: http://api.hsinchu.dpdns.org
- **管理後台**: http://admin.hsinchu.dpdns.org
- **健康檢查**: http://api.hsinchu.dpdns.org/health

### 核心功能端點
```
認證相關：
POST /api/auth/register - 用戶註冊
POST /api/auth/login - 用戶登入

患者管理：
GET  /api/patients - 獲取患者列表
POST /api/patients - 新增患者
PUT  /api/patients/:id - 更新患者資料
DELETE /api/patients/:id - 刪除患者

位置追蹤：
POST /api/locations - 更新位置
GET  /api/locations/:id/history - 位置歷史

警報系統：
GET  /api/alerts - 獲取警報列表
POST /api/alerts - 建立新警報
PUT  /api/alerts/:id/read - 標記已讀

地理圍欄：
GET  /api/geofences - 獲取地理圍欄
POST /api/geofences - 新增地理圍欄
PUT  /api/geofences/:id - 更新圍欄
DELETE /api/geofences/:id - 刪除圍欄
POST /api/geofences/check - 檢查位置

模擬功能：
GET  /api/simulation/scenarios - 獲取模擬場景
POST /api/simulation/start - 開始模擬
GET  /api/simulation/current/:id - 獲取當前位置
POST /api/simulation/stop/:id - 停止模擬
```

## 👥 系統帳號

### 管理員帳號
- **Email**: admin@hsinchu.gov.tw
- **密碼**: admin123
- **權限**: 完整系統管理權限

### 測試用戶帳號
- **Email**: test@hsinchu.gov.tw
- **密碼**: test123
- **權限**: 一般用戶權限

### 行動應用測試帳號
- **Email**: test@example.com
- **密碼**: test123
- **權限**: 一般用戶權限

## 📊 Demo 資料統計

### 警報記錄
- **總數**: 12 筆
- **類型分布**:
  - 🔴 緊急 (Critical): 2 筆
  - 🟠 高度 (High): 2 筆
  - 🟡 中度 (Medium): 4 筆
  - 🔵 低度 (Low): 2 筆
  - ⚪ 資訊 (Info): 2 筆

### 地理圍欄區域
- **總數**: 10 個區域
- **類型分布**:
  - 🟢 安全區域: 3 個
  - 🟡 警戒區域: 3 個
  - 🔴 危險區域: 3 個
  - 🚫 限制區域: 1 個

### 模擬場景
- **場景1**: 早晨散步迷路（王大明）
- **場景2**: 就醫後迷失方向（李小美）
- **場景3**: 夜市走失（張志強）

## 🔧 系統配置

### 環境變數
```bash
NODE_ENV=production
PUBLIC_IP=hsinchu.dpdns.org
DATABASE_URL=postgresql://hccg:hccg2025@localhost:5432/hccg_development
REDIS_URL=redis://localhost:6379
JWT_SECRET=hsinchu-guardian-secret-2025
```

### 自動重啟設定
- ✅ PM2 自動重啟已啟用
- ✅ Docker 容器設定為 unless-stopped
- ✅ 系統開機自動啟動腳本已配置

## 📝 維護注意事項

1. **資料庫備份**: PostgreSQL 資料存儲在 Docker volume 中
2. **日誌檔案**:
   - PM2 日誌: `~/.pm2/logs/`
   - Docker 日誌: `docker logs [container_name]`
3. **服務重啟指令**:
   ```bash
   # PM2 服務
   pm2 restart all

   # Docker 服務
   docker-compose restart
   ```

## 🚨 監控端點

- **健康檢查**: http://api.hsinchu.dpdns.org/health
- **系統統計**: http://api.hsinchu.dpdns.org/api/admin/stats (需管理員權限)
- **WebSocket 狀態**: 透過 Socket.IO 連線數監控

## 📞 技術支援

如遇問題，請檢查：
1. PM2 服務狀態: `pm2 status`
2. Docker 容器狀態: `docker ps`
3. 系統日誌: `pm2 logs`
4. 網路連通性: `curl http://api.hsinchu.dpdns.org/health`

---
系統版本: v1.3.1 | 最後更新: 2025-09-19