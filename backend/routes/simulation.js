const express = require('express');
const router = express.Router();

// 新竹市重要地標和迷路熱點
const hsinchuLocations = {
    // 起點：家
    home: {
        name: '王大明的家',
        latitude: 24.8047,
        longitude: 120.9688,
        address: '新竹市東區公園路50號'
    },

    // 常去的地點
    hospital: {
        name: '新竹馬偕紀念醫院',
        latitude: 24.8072,
        longitude: 120.9724,
        address: '新竹市東區光復路二段690號'
    },

    // 可能迷路的地點
    traditionalMarket: {
        name: '東門市場',
        latitude: 24.8033,
        longitude: 120.9666,
        address: '新竹市東區中央路'
    },

    cityGodTemple: {
        name: '新竹都城隍廟',
        latitude: 24.8061,
        longitude: 120.9658,
        address: '新竹市北區中山路75號'
    },

    trainStation: {
        name: '新竹火車站',
        latitude: 24.8019,
        longitude: 120.9718,
        address: '新竹市東區中華路二段445號'
    },

    bigCity: {
        name: '巨城購物中心',
        latitude: 24.8089,
        longitude: 120.9735,
        address: '新竹市東區中央路229號'
    },

    sciencePark: {
        name: '新竹科學園區',
        latitude: 24.7857,
        longitude: 121.0033,
        address: '新竹市東區新安路2號'
    },

    beigangTemple: {
        name: '竹蓮寺',
        latitude: 24.8055,
        longitude: 120.9698,
        address: '新竹市東區竹蓮街100號'
    },

    greenGrassLake: {
        name: '青草湖',
        latitude: 24.7916,
        longitude: 120.9585,
        address: '新竹市東區明湖路'
    },

    zhubeiNightMarket: {
        name: '竹北夜市',
        latitude: 24.8395,
        longitude: 121.0092,
        address: '新竹縣竹北市'
    }
};

// 模擬路徑場景
const simulationScenarios = [
    {
        id: 'scenario1',
        name: '早晨散步迷路',
        description: '王大明早上出門散步，在東門市場附近迷路',
        patient: {
            id: 1,
            name: '王大明',
            age: 75,
            condition: '輕度失智'
        },
        waypoints: [
            { ...hsinchuLocations.home, time: 0, status: 'normal' },
            { lat: 24.8045, lng: 120.9685, time: 5, status: 'normal' },
            { lat: 24.8042, lng: 120.9680, time: 10, status: 'normal' },
            { lat: 24.8038, lng: 120.9675, time: 15, status: 'normal' },
            { ...hsinchuLocations.traditionalMarket, time: 20, status: 'normal' },
            { lat: 24.8030, lng: 120.9662, time: 25, status: 'wandering' },
            { lat: 24.8028, lng: 120.9658, time: 30, status: 'wandering' },
            { lat: 24.8035, lng: 120.9655, time: 35, status: 'lost' },
            { lat: 24.8040, lng: 120.9652, time: 40, status: 'lost', alert: 'geofence_exit' },
            { lat: 24.8045, lng: 120.9650, time: 45, status: 'lost' },
            { lat: 24.8048, lng: 120.9648, time: 50, status: 'lost' }
        ]
    },
    {
        id: 'scenario2',
        name: '就醫後迷失方向',
        description: '李小美看完醫生後，在醫院附近迷失方向',
        patient: {
            id: 2,
            name: '李小美',
            age: 68,
            condition: '中度失智'
        },
        waypoints: [
            { ...hsinchuLocations.hospital, time: 0, status: 'normal' },
            { lat: 24.8070, lng: 120.9720, time: 5, status: 'normal' },
            { lat: 24.8065, lng: 120.9715, time: 10, status: 'wandering' },
            { lat: 24.8062, lng: 120.9710, time: 15, status: 'wandering' },
            { lat: 24.8058, lng: 120.9705, time: 20, status: 'lost' },
            { lat: 24.8055, lng: 120.9700, time: 25, status: 'lost', alert: 'no_movement' },
            { ...hsinchuLocations.beigangTemple, time: 35, status: 'lost' },
            { lat: 24.8058, lng: 120.9695, time: 40, status: 'lost' },
            { lat: 24.8060, lng: 120.9690, time: 45, status: 'lost', alert: 'geofence_exit' }
        ]
    },
    {
        id: 'scenario3',
        name: '夜市走失',
        description: '張志強在城隍廟附近夜市走失',
        patient: {
            id: 3,
            name: '張志強',
            age: 72,
            condition: '輕度失智'
        },
        waypoints: [
            { ...hsinchuLocations.cityGodTemple, time: 0, status: 'normal' },
            { lat: 24.8063, lng: 120.9660, time: 5, status: 'normal' },
            { lat: 24.8065, lng: 120.9663, time: 10, status: 'normal' },
            { lat: 24.8068, lng: 120.9665, time: 15, status: 'wandering' },
            { lat: 24.8070, lng: 120.9668, time: 20, status: 'wandering' },
            { lat: 24.8073, lng: 120.9670, time: 25, status: 'lost' },
            { lat: 24.8076, lng: 120.9673, time: 30, status: 'lost' },
            { lat: 24.8080, lng: 120.9675, time: 35, status: 'lost', alert: 'emergency_sos' },
            { lat: 24.8083, lng: 120.9678, time: 40, status: 'lost' },
            { lat: 24.8085, lng: 120.9680, time: 45, status: 'found' }
        ]
    }
];

// 記憶體中存儲當前模擬狀態
let activeSimulations = {};

// 開始模擬
router.post('/start', (req, res) => {
    const { scenarioId, patientId, speed = 1 } = req.body;

    const scenario = simulationScenarios.find(s => s.id === scenarioId) || simulationScenarios[0];
    const simulationId = `sim_${Date.now()}`;

    activeSimulations[simulationId] = {
        id: simulationId,
        scenario: scenario,
        currentIndex: 0,
        speed: speed,
        startTime: Date.now(),
        status: 'running',
        patientId: patientId || scenario.patient.id
    };

    res.json({
        success: true,
        simulationId,
        scenario: scenario.name,
        totalWaypoints: scenario.waypoints.length
    });
});

// 獲取當前位置
router.get('/current/:simulationId', (req, res) => {
    const simulation = activeSimulations[req.params.simulationId];

    if (!simulation) {
        return res.status(404).json({ error: '模擬不存在' });
    }

    const elapsedTime = (Date.now() - simulation.startTime) / 1000 * simulation.speed;
    const waypoints = simulation.scenario.waypoints;

    // 找到當前位置
    let currentPosition = null;
    let nextWaypoint = null;

    for (let i = 0; i < waypoints.length - 1; i++) {
        if (elapsedTime >= waypoints[i].time && elapsedTime < waypoints[i + 1].time) {
            const progress = (elapsedTime - waypoints[i].time) / (waypoints[i + 1].time - waypoints[i].time);

            currentPosition = {
                latitude: waypoints[i].lat || waypoints[i].latitude +
                    (waypoints[i + 1].lat || waypoints[i + 1].latitude - waypoints[i].lat || waypoints[i].latitude) * progress,
                longitude: waypoints[i].lng || waypoints[i].longitude +
                    (waypoints[i + 1].lng || waypoints[i + 1].longitude - waypoints[i].lng || waypoints[i].longitude) * progress,
                status: waypoints[i].status,
                alert: waypoints[i].alert,
                address: waypoints[i].address || '移動中',
                speed: Math.random() * 2 + 1, // 1-3 km/h
                battery: 100 - Math.floor(elapsedTime / 60 * 10), // 電量消耗
                accuracy: 10 + Math.random() * 5,
                timestamp: new Date()
            };

            simulation.currentIndex = i;
            break;
        }
    }

    // 如果已經到達終點
    if (elapsedTime >= waypoints[waypoints.length - 1].time) {
        currentPosition = {
            latitude: waypoints[waypoints.length - 1].lat || waypoints[waypoints.length - 1].latitude,
            longitude: waypoints[waypoints.length - 1].lng || waypoints[waypoints.length - 1].longitude,
            status: waypoints[waypoints.length - 1].status,
            alert: waypoints[waypoints.length - 1].alert,
            address: waypoints[waypoints.length - 1].address || '位置不明',
            speed: 0,
            battery: 100 - Math.floor(waypoints[waypoints.length - 1].time / 60 * 10),
            accuracy: 10,
            timestamp: new Date()
        };
        simulation.status = 'completed';
    }

    res.json({
        success: true,
        simulation: {
            id: simulation.id,
            status: simulation.status,
            scenario: simulation.scenario.name,
            patient: simulation.scenario.patient
        },
        position: currentPosition,
        trajectory: waypoints.slice(0, simulation.currentIndex + 1)
    });
});

// 停止模擬
router.post('/stop/:simulationId', (req, res) => {
    const simulation = activeSimulations[req.params.simulationId];

    if (!simulation) {
        return res.status(404).json({ error: '模擬不存在' });
    }

    simulation.status = 'stopped';
    delete activeSimulations[req.params.simulationId];

    res.json({
        success: true,
        message: '模擬已停止'
    });
});

// 獲取所有場景
router.get('/scenarios', (req, res) => {
    res.json({
        success: true,
        scenarios: simulationScenarios.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            patient: s.patient,
            duration: s.waypoints[s.waypoints.length - 1].time + ' 分鐘'
        }))
    });
});

// 獲取所有活躍模擬
router.get('/active', (req, res) => {
    const active = Object.values(activeSimulations).filter(s => s.status === 'running');

    res.json({
        success: true,
        simulations: active.map(s => ({
            id: s.id,
            scenario: s.scenario.name,
            patient: s.scenario.patient,
            status: s.status,
            startTime: new Date(s.startTime),
            currentIndex: s.currentIndex
        }))
    });
});

module.exports = router;