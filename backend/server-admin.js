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