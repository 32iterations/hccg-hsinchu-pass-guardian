const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// In-memory storage (繼承自 server-simple.js)
const users = [];
const patients = [];
const locations = [];
const admins = [];
const alerts = [];

const JWT_SECRET = process.env.JWT_SECRET || 'hsinchu-guardian-secret-2025';

// 初始化管理員帳號
async function initializeAdmin() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    admins.push({
        id: 1,
        email: 'admin@hsinchu.gov.tw',
        password_hash: hashedPassword,
        name: '系統管理員',
        role: 'admin',
        created_at: new Date()
    });
    console.log('✅ 管理員帳號已初始化: admin@hsinchu.gov.tw / admin123');
}

initializeAdmin();

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: '新竹安心守護 API (含管理介面)',
        timestamp: new Date().toISOString(),
        ip: process.env.PUBLIC_IP,
        connections: io.engine.clientsCount || 0
    });
});

// ==================== AUTH ENDPOINTS ====================

// Admin/User Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 先檢查管理員
        let user = admins.find(u => u.email === email);
        let isAdmin = true;

        // 如果不是管理員，檢查一般用戶
        if (!user) {
            user = users.find(u => u.email === email);
            isAdmin = false;
        }

        if (!user) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordValid) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                isAdmin
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isAdmin
            }
        });

        // 通知 WebSocket 客戶端
        io.emit('adminLogin', {
            name: user.name,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '登入失敗' });
    }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, role, phone } = req.body;

    try {
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ error: '此電子郵件已被註冊' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            id: users.length + 1,
            email,
            password_hash: hashedPassword,
            name,
            role,
            phone,
            created_at: new Date()
        };

        users.push(user);

        const token = jwt.sign(
            { id: user.id, email, role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: '註冊失敗' });
    }
});

// ==================== MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ==================== ALERTS ENDPOINTS ====================

// Get all alerts
app.get('/api/alerts', authenticateToken, (req, res) => {
    // 根據用戶角色過濾警報
    let userAlerts = alerts;

    if (!req.user.isAdmin) {
        // 一般用戶只能看到自己患者的警報
        const userPatients = patients.filter(p => p.guardian_id === req.user.id);
        const patientIds = userPatients.map(p => p.id);
        userAlerts = alerts.filter(a => patientIds.includes(a.patientId));
    }

    // 按時間排序，最新的在前
    userAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
        success: true,
        alerts: userAlerts
    });
});

// Create new alert
app.post('/api/alerts', authenticateToken, (req, res) => {
    const alert = {
        id: alerts.length + 1,
        ...req.body,
        created_at: new Date()
    };

    alerts.push(alert);

    // 透過 WebSocket 發送即時通知
    io.emit('new-alert', alert);

    res.json({
        success: true,
        alert
    });
});

// Mark alert as read
app.put('/api/alerts/:id/read', authenticateToken, (req, res) => {
    const alert = alerts.find(a => a.id === parseInt(req.params.id));

    if (!alert) {
        return res.status(404).json({ error: '警報不存在' });
    }

    alert.read = true;
    alert.read_at = new Date();

    res.json({
        success: true,
        alert
    });
});

// ==================== PATIENT ENDPOINTS ====================

// Add patient
app.post('/api/patients', authenticateToken, (req, res) => {
    const { name, age, address, emergency_contact, beacon_id } = req.body;

    const patient = {
        id: patients.length + 1,
        name,
        age,
        address,
        guardian_id: req.user.id,
        emergency_contact,
        beacon_id,
        created_at: new Date(),
        last_seen: null,
        last_location: null
    };

    patients.push(patient);

    // 通知所有管理員
    io.emit('patientAdded', patient);

    res.json({
        success: true,
        patient
    });
});

// Get patients (管理員可以看到所有，用戶只能看到自己的)
app.get('/api/patients', authenticateToken, (req, res) => {
    let userPatients;

    if (req.user.isAdmin) {
        userPatients = patients;
    } else {
        userPatients = patients.filter(p => p.guardian_id === req.user.id);
    }

    res.json({
        success: true,
        patients: userPatients
    });
});

// ==================== LOCATION ENDPOINTS ====================

// Update location
app.post('/api/locations', authenticateToken, (req, res) => {
    const { patient_id, latitude, longitude, accuracy, battery_level } = req.body;

    const patient = patients.find(p => p.id === patient_id);
    if (!patient) {
        return res.status(404).json({ error: '患者不存在' });
    }

    const location = {
        id: locations.length + 1,
        patient_id,
        latitude,
        longitude,
        accuracy,
        battery_level,
        timestamp: new Date()
    };

    locations.push(location);

    // 更新患者的最後位置和時間
    patient.last_location = location;
    patient.last_seen = new Date();

    // 通過 WebSocket 即時廣播位置更新
    io.emit('locationUpdate', {
        patient,
        location
    });

    res.json({
        success: true,
        location
    });
});

// Get location history
app.get('/api/locations/:patientId/history', authenticateToken, (req, res) => {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const patientLocations = locations
        .filter(l => l.patient_id === parseInt(patientId))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

    res.json({
        success: true,
        locations: patientLocations
    });
});

// ==================== ADMIN ENDPOINTS ====================

// Get system statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const onlineCount = patients.filter(p =>
        p.last_seen && (new Date() - new Date(p.last_seen)) < 300000
    ).length;

    res.json({
        success: true,
        stats: {
            totalPatients: patients.length,
            totalUsers: users.length,
            onlineDevices: onlineCount,
            totalLocations: locations.length,
            activeAlerts: 0 // 可以根據實際邏輯實作
        }
    });
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    const safeUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone,
        created_at: u.created_at
    }));

    res.json({
        success: true,
        users: safeUsers
    });
});

// ==================== WEBSOCKET HANDLING ====================

io.on('connection', (socket) => {
    console.log('新的 WebSocket 連接:', socket.id);

    // 驗證連接
    socket.on('authenticate', (token) => {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                socket.emit('authError', 'Invalid token');
                socket.disconnect();
            } else {
                socket.user = user;
                socket.join(user.isAdmin ? 'admins' : 'users');
                socket.emit('authenticated', user);
                console.log(`用戶 ${user.email} 已驗證並連接`);
            }
        });
    });

    // 訂閱特定患者的更新
    socket.on('subscribePatient', (patientId) => {
        if (socket.user) {
            socket.join(`patient-${patientId}`);
            console.log(`${socket.user.email} 訂閱了患者 ${patientId} 的更新`);
        }
    });

    // 發送緊急警報
    socket.on('emergencyAlert', (data) => {
        if (socket.user) {
            io.emit('emergencyBroadcast', {
                ...data,
                sender: socket.user.name,
                timestamp: new Date()
            });
            console.log(`緊急警報: ${JSON.stringify(data)}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('WebSocket 連接斷開:', socket.id);
    });
});

// ==================== TEST DATA ====================

// Create test data
app.post('/api/test/setup', async (req, res) => {
    // 創建測試用戶
    const hashedPassword = await bcrypt.hash('test123', 10);

    const testUser = {
        id: users.length + 1,
        email: 'test@hsinchu.gov.tw',
        password_hash: hashedPassword,
        name: '測試用戶',
        role: 'family',
        phone: '0912345678',
        created_at: new Date()
    };
    users.push(testUser);

    // 創建測試患者
    const testPatients = [
        {
            id: patients.length + 1,
            name: '王大明',
            age: 75,
            address: '新竹市東區光復路一段',
            guardian_id: testUser.id,
            emergency_contact: '0912345678',
            beacon_id: 'BEACON-001',
            created_at: new Date(),
            last_seen: new Date(),
            last_location: {
                latitude: 24.8138,
                longitude: 120.9675,
                accuracy: 10,
                battery_level: 85,
                timestamp: new Date()
            }
        },
        {
            id: patients.length + 2,
            name: '李小美',
            age: 68,
            address: '新竹市北區中正路',
            guardian_id: testUser.id,
            emergency_contact: '0987654321',
            beacon_id: 'BEACON-002',
            created_at: new Date(),
            last_seen: new Date(),
            last_location: {
                latitude: 24.8058,
                longitude: 120.9705,
                accuracy: 15,
                battery_level: 92,
                timestamp: new Date()
            }
        }
    ];

    patients.push(...testPatients);

    // 創建測試位置歷史
    testPatients.forEach(patient => {
        for (let i = 0; i < 10; i++) {
            locations.push({
                id: locations.length + 1,
                patient_id: patient.id,
                latitude: patient.last_location.latitude + (Math.random() - 0.5) * 0.01,
                longitude: patient.last_location.longitude + (Math.random() - 0.5) * 0.01,
                accuracy: 10 + Math.random() * 10,
                battery_level: 80 + Math.random() * 20,
                timestamp: new Date(Date.now() - i * 3600000) // 每小時一個點
            });
        }
    });

    res.json({
        success: true,
        message: '測試資料已建立',
        credentials: {
            admin: {
                email: 'admin@hsinchu.gov.tw',
                password: 'admin123'
            },
            user: {
                email: 'test@hsinchu.gov.tw',
                password: 'test123'
            }
        },
        patients: testPatients.length,
        locations: locations.length
    });
});

// ==================== SIMULATION ENDPOINTS ====================
const simulationRouter = require('./routes/simulation');
app.use('/api/simulation', authenticateToken, simulationRouter);

// ==================== GEOFENCE ENDPOINTS ====================

// 新竹市常見長者活動區域和易迷路地點
const geofenceZones = [
    {
        id: 1,
        name: '家 - 安全區域',
        center: { latitude: 24.8047, longitude: 120.9688 },
        radius: 100,
        type: 'safe',
        address: '新竹市東區公園路50號',
        description: '患者居住地址，主要安全區域'
    },
    {
        id: 2,
        name: '新竹馬偕紀念醫院',
        center: { latitude: 24.8072, longitude: 120.9724 },
        radius: 200,
        type: 'safe',
        address: '新竹市東區光復路二段690號',
        description: '定期回診醫院'
    },
    {
        id: 3,
        name: '東門市場',
        center: { latitude: 24.8033, longitude: 120.9666 },
        radius: 150,
        type: 'warning',
        address: '新竹市東區中央路',
        description: '人潮擁擠，容易迷失方向'
    },
    {
        id: 4,
        name: '新竹都城隍廟',
        center: { latitude: 24.8061, longitude: 120.9658 },
        radius: 100,
        type: 'warning',
        address: '新竹市北區中山路75號',
        description: '廟會活動多，環境複雜'
    },
    {
        id: 5,
        name: '新竹火車站',
        center: { latitude: 24.8019, longitude: 120.9718 },
        radius: 250,
        type: 'danger',
        address: '新竹市東區中華路二段445號',
        description: '交通繁忙，高風險區域'
    },
    {
        id: 6,
        name: '巨城購物中心',
        center: { latitude: 24.8089, longitude: 120.9735 },
        radius: 200,
        type: 'warning',
        address: '新竹市東區中央路229號',
        description: '大型商場，容易迷路'
    },
    {
        id: 7,
        name: '竹蓮寺',
        center: { latitude: 24.8055, longitude: 120.9698 },
        radius: 80,
        type: 'safe',
        address: '新竹市東區竹蓮街100號',
        description: '常去的寺廟'
    },
    {
        id: 8,
        name: '青草湖',
        center: { latitude: 24.7916, longitude: 120.9585 },
        radius: 500,
        type: 'danger',
        address: '新竹市東區明湖路',
        description: '水域危險區域'
    },
    {
        id: 9,
        name: '新竹科學園區',
        center: { latitude: 24.7857, longitude: 121.0033 },
        radius: 1000,
        type: 'restricted',
        address: '新竹市東區新安路2號',
        description: '限制進入區域'
    },
    {
        id: 10,
        name: '十八尖山',
        center: { latitude: 24.7934, longitude: 120.9752 },
        radius: 300,
        type: 'danger',
        address: '新竹市東區博愛街',
        description: '山區，易迷路'
    }
];

// 獲取所有地理圍欄
app.get('/api/geofences', authenticateToken, (req, res) => {
    const patientId = req.query.patientId;

    // 如果指定患者，返回該患者的圍欄設定
    if (patientId) {
        const patient = patients.find(p => p.id === parseInt(patientId));
        if (patient && patient.geofences) {
            return res.json({
                success: true,
                geofences: patient.geofences
            });
        }
    }

    // 返回預設圍欄
    res.json({
        success: true,
        geofences: geofenceZones
    });
});

// 新增地理圍欄
app.post('/api/geofences', authenticateToken, (req, res) => {
    const { name, center, radius, type, address, description, patientId } = req.body;

    const newGeofence = {
        id: geofenceZones.length + 1,
        name,
        center,
        radius,
        type: type || 'custom',
        address,
        description,
        created_by: req.user.id,
        created_at: new Date()
    };

    if (patientId) {
        // 為特定患者新增圍欄
        const patient = patients.find(p => p.id === patientId);
        if (patient) {
            if (!patient.geofences) {
                patient.geofences = [];
            }
            patient.geofences.push(newGeofence);
        }
    } else {
        // 新增到全域圍欄
        geofenceZones.push(newGeofence);
    }

    res.json({
        success: true,
        geofence: newGeofence
    });
});

// 更新地理圍欄
app.put('/api/geofences/:id', authenticateToken, (req, res) => {
    const geofenceId = parseInt(req.params.id);
    const updates = req.body;

    const geofence = geofenceZones.find(g => g.id === geofenceId);
    if (!geofence) {
        return res.status(404).json({ error: '地理圍欄不存在' });
    }

    Object.assign(geofence, updates, {
        updated_at: new Date(),
        updated_by: req.user.id
    });

    res.json({
        success: true,
        geofence
    });
});

// 刪除地理圍欄
app.delete('/api/geofences/:id', authenticateToken, (req, res) => {
    const geofenceId = parseInt(req.params.id);
    const index = geofenceZones.findIndex(g => g.id === geofenceId);

    if (index === -1) {
        return res.status(404).json({ error: '地理圍欄不存在' });
    }

    geofenceZones.splice(index, 1);

    res.json({
        success: true,
        message: '地理圍欄已刪除'
    });
});

// 檢查位置是否在圍欄內
app.post('/api/geofences/check', authenticateToken, (req, res) => {
    const { latitude, longitude, patientId } = req.body;

    const violations = [];
    const warnings = [];

    // 獲取患者的圍欄設定
    let checkZones = geofenceZones;
    const patient = patients.find(p => p.id === patientId);
    if (patient && patient.geofences) {
        checkZones = [...geofenceZones, ...patient.geofences];
    }

    // 檢查每個圍欄
    checkZones.forEach(zone => {
        const distance = calculateDistance(
            latitude, longitude,
            zone.center.latitude, zone.center.longitude
        );

        if (zone.type === 'safe' && distance > zone.radius) {
            violations.push({
                zone,
                distance,
                message: `已離開安全區域: ${zone.name}`,
                severity: 'high'
            });
        } else if (zone.type === 'danger' && distance < zone.radius) {
            violations.push({
                zone,
                distance,
                message: `進入危險區域: ${zone.name}`,
                severity: 'critical'
            });
        } else if (zone.type === 'warning' && distance < zone.radius) {
            warnings.push({
                zone,
                distance,
                message: `進入警戒區域: ${zone.name}`,
                severity: 'medium'
            });
        } else if (zone.type === 'restricted' && distance < zone.radius) {
            violations.push({
                zone,
                distance,
                message: `進入限制區域: ${zone.name}`,
                severity: 'high'
            });
        }
    });

    res.json({
        success: true,
        violations,
        warnings,
        position: { latitude, longitude },
        timestamp: new Date()
    });
});

// 計算兩點間距離（公尺）
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 地球半徑（公尺）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// ==================== SERVER START ====================

const PORT = process.env.ADMIN_PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 新竹安心守護管理系統啟動成功！

    📡 API Server: http://${process.env.PUBLIC_IP || 'localhost'}:${PORT}
    🖥️  管理介面: http://${process.env.PUBLIC_IP || 'localhost'}:${PORT}/admin

    📍 健康檢查: http://${process.env.PUBLIC_IP || 'localhost'}:${PORT}/health

    🔑 管理員帳號:
       Email: admin@hsinchu.gov.tw
       Password: admin123

    📚 API 端點:
       - POST /api/auth/login - 登入
       - POST /api/auth/register - 註冊
       - GET  /api/patients - 取得患者列表
       - POST /api/patients - 新增患者
       - POST /api/locations - 更新位置
       - GET  /api/locations/:id/history - 位置歷史
       - GET  /api/admin/stats - 系統統計 (管理員)
       - GET  /api/admin/users - 用戶列表 (管理員)

    🧪 測試資料:
       POST /api/test/setup - 建立測試資料

    🔧 環境: ${process.env.NODE_ENV || 'development'}
    💾 資料儲存: 記憶體（重啟會清空）
    🔌 WebSocket: 已啟用即時通訊
  `);
});

module.exports = { app, server, io };