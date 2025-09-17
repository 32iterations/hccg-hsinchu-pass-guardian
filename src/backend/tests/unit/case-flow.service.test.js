/**
 * @fileoverview Case Flow Service Unit Tests (RED Phase - TDD)
 * @description 案件流程服務測試 - 新竹市安心守護系統
 *
 * Test Coverage:
 * 1. Case creation with proper metadata
 * 2. State transitions (建立→派發→結案)
 * 3. Multi-agency coordination (police, fire, medical)
 * 4. Real-time status updates and notifications
 * 5. Case escalation based on severity
 * 6. Search area management and zone assignments
 * 7. Volunteer dispatch and coordination
 * 8. Case resolution and closure workflows
 * 9. Performance metrics tracking
 * 10. Case handoff between shifts
 * 11. Emergency escalation triggers
 *
 * @author Taiwan Emergency Response System
 * @created 2025-09-17
 */

const CaseFlowService = require('../../src/services/case-flow.service');
const RbacService = require('../../src/services/rbac.service');
const AuditLogService = require('../../src/services/audit-log.service');
const NotificationService = require('../../src/services/notification.service');

// Mock dependencies
jest.mock('../../src/services/rbac.service');
jest.mock('../../src/services/audit-log.service');
jest.mock('../../src/services/notification.service');

describe('案件流程服務 (CaseFlowService)', () => {
  let caseFlowService;
  let mockRbacService;
  let mockAuditService;
  let mockNotificationService;

  beforeEach(() => {
    // Setup fake timers BEFORE any other setup
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-17T10:00:00Z'));

    // Reset all mocks first
    jest.clearAllMocks();

    mockRbacService = new RbacService();
    mockAuditService = new AuditLogService();
    mockNotificationService = new NotificationService();

    // Mock RBAC service methods
    mockRbacService.hasPermission = jest.fn().mockResolvedValue(true);
    mockRbacService.getUserRole = jest.fn().mockResolvedValue('Operator');
    mockRbacService.getRolePermissions = jest.fn().mockResolvedValue(['CREATE_CASE', 'UPDATE_CASE', 'READ_CASE']);
    mockRbacService.checkResourceAvailability = jest.fn().mockResolvedValue(true);
    mockRbacService.getAvailableResources = jest.fn().mockResolvedValue({
      searchTeams: ['team1', 'team2'],
      vehicles: 5,
      personnel: 20
    });

    // Mock Audit service methods
    mockAuditService.log = jest.fn().mockResolvedValue(true);

    // Mock Notification service methods
    mockNotificationService.notifyAssignment = jest.fn().mockResolvedValue(true);
    mockNotificationService.createCommunicationChannel = jest.fn().mockResolvedValue(true);
    mockNotificationService.emergencyBroadcast = jest.fn().mockResolvedValue(true);
    mockNotificationService.broadcast = jest.fn().mockResolvedValue(true);
    mockNotificationService.createWebSocketSubscription = jest.fn().mockResolvedValue(true);
    mockNotificationService.notifyQualifiedVolunteers = jest.fn().mockResolvedValue(true);
    mockNotificationService.sendVolunteerAlert = jest.fn().mockResolvedValue(true);

    caseFlowService = new CaseFlowService({
      rbacService: mockRbacService,
      auditService: mockAuditService,
      notificationService: mockNotificationService
    });

    // Add missing mock methods for case flow service
    caseFlowService.scheduleDataRetention = jest.fn().mockResolvedValue(true);
    caseFlowService.initiateFamilyNotification = jest.fn().mockResolvedValue(true);
    caseFlowService.scheduleDebriefing = jest.fn().mockResolvedValue(true);
    caseFlowService.updateStatistics = jest.fn().mockResolvedValue(true);
    caseFlowService.updateKPIMetrics = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('1. 案件建立 (Case Creation)', () => {
    describe('createCase()', () => {
      it('應該成功建立失蹤人員案件', async () => {
        const caseData = {
          type: 'MISSING_PERSON',
          title: '新竹東區失蹤長者案',
          description: '77歲失智長者於新竹火車站附近失蹤',
          location: {
            latitude: 24.8018,
            longitude: 120.9714,
            address: '新竹市東區中正路1號'
          },
          missingPerson: {
            name: '陳○○',
            age: 77,
            gender: 'MALE',
            height: 165,
            clothing: '白色襯衫、黑色長褲',
            medicalCondition: '失智症'
          },
          reporter: {
            name: '陳○○',
            relationship: '子女',
            phone: '09xxxxxxxx'
          },
          severity: 'HIGH',
          priority: 1
        };

        const result = await caseFlowService.createCase(caseData, 'user123');

        expect(result).toHaveProperty('caseId');
        expect(result).toHaveProperty('caseNumber');
        expect(result.status).toBe('CREATED');
        expect(result.metadata.createdBy).toBe('user123');
        expect(result.metadata.createdAt).toBeInstanceOf(Date);
      });

      it('應該為緊急案件自動設定最高優先級', async () => {
        const emergencyCase = {
          type: 'EMERGENCY_MISSING',
          title: '新竹香山區兒童緊急失蹤案',
          severity: 'CRITICAL',
          missingPerson: {
            name: '王○○',
            age: 8,
            gender: 'FEMALE'
          }
        };

        const result = await caseFlowService.createCase(emergencyCase, 'officer456');

        expect(result.priority).toBe(0); // 最高優先級
        expect(result.escalationLevel).toBe('IMMEDIATE');
        expect(result.autoAssignedAgencies).toContain('POLICE');
        expect(result.autoAssignedAgencies).toContain('FIRE');
      });

      it('應該記錄案件建立的稽核日誌', async () => {
        const caseData = { type: 'MISSING_PERSON', title: '測試案件' };

        await caseFlowService.createCase(caseData, 'admin789');

        expect(mockAuditService.log).toHaveBeenCalledWith({
          action: 'CASE_CREATED',
          userId: 'admin789',
          caseId: expect.any(String),
          timestamp: expect.any(Date),
          details: expect.objectContaining({
            type: 'MISSING_PERSON',
            title: '測試案件'
          })
        });
      });

      it('應該拒絕無效的案件資料', async () => {
        const invalidData = {
          type: 'INVALID_TYPE',
          title: '' // 空標題
        };

        await expect(caseFlowService.createCase(invalidData, 'user123'))
          .rejects.toThrow('不支援的案件類型');
      });

      it('應該為不同類型案件設定適當的預設值', async () => {
        const trafficCase = {
          type: 'TRAFFIC_ACCIDENT',
          title: '光復路車禍案件',
          location: { latitude: 24.8, longitude: 120.97 }
        };

        const result = await caseFlowService.createCase(trafficCase, 'traffic001');

        expect(result.assignedAgencies).toContain('POLICE');
        expect(result.assignedAgencies).toContain('FIRE');
        expect(result.assignedAgencies).toContain('MEDICAL');
        expect(result.estimatedResponseTime).toBe(15); // 分鐘
      });
    });

    describe('案件編號生成', () => {
      it('應該生成唯一的案件編號', async () => {
        const case1 = await caseFlowService.createCase({ type: 'MISSING_PERSON', title: '案件1' }, 'user1');
        const case2 = await caseFlowService.createCase({ type: 'MISSING_PERSON', title: '案件2' }, 'user2');

        expect(case1.caseNumber).not.toBe(case2.caseNumber);
        expect(case1.caseNumber).toMatch(/^HC\d{8}-\d{4}$/); // HC20250917-0001 格式
      });

      it('應該包含日期和序號的案件編號', async () => {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        const result = await caseFlowService.createCase({ type: 'MISSING_PERSON', title: '測試' }, 'user1');

        expect(result.caseNumber).toContain(today);
        expect(result.caseNumber).toMatch(/^HC\d{8}-\d{4}$/);
      });
    });
  });

  describe('2. 狀態轉換 (State Transitions)', () => {
    let testCase;

    beforeEach(async () => {
      testCase = await caseFlowService.createCase({
        type: 'MISSING_PERSON',
        title: '測試案件',
        severity: 'MEDIUM'
      }, 'officer123');
    });

    describe('assignCase()', () => {
      it('應該將案件從建立狀態轉為派發狀態', async () => {
        const assignment = {
          assignedTo: 'team_alpha',
          assignedBy: 'supervisor001',
          agency: 'POLICE',
          expectedResponseTime: 30
        };

        const result = await caseFlowService.assignCase(testCase.caseId, assignment);

        expect(result.status).toBe('ASSIGNED');
        expect(result.assignedTo).toBe('team_alpha');
        expect(result.assignedAt).toBeInstanceOf(Date);
      });

      it('應該記錄狀態轉換歷史', async () => {
        const assignment = { assignedTo: 'team_beta', assignedBy: 'supervisor002' };

        await caseFlowService.assignCase(testCase.caseId, assignment);

        const history = await caseFlowService.getCaseHistory(testCase.caseId);
        expect(history).toHaveLength(2); // CREATED + ASSIGNED
        expect(history[1].status).toBe('ASSIGNED');
        expect(history[1].actor).toBe('supervisor002');
      });

      it('應該通知相關人員案件派發', async () => {
        const assignment = { assignedTo: 'team_gamma', assignedBy: 'supervisor003' };

        await caseFlowService.assignCase(testCase.caseId, assignment);

        expect(mockNotificationService.notifyAssignment).toHaveBeenCalledWith({
          caseId: testCase.caseId,
          assignedTo: 'team_gamma',
          assignedBy: 'supervisor003',
          caseTitle: '測試案件'
        });
      });

      it('應該拒絕派發已結案的案件', async () => {
        await caseFlowService.closeCase(testCase.caseId, { closedBy: 'admin' });

        await expect(caseFlowService.assignCase(testCase.caseId, { assignedTo: 'team' }))
          .rejects.toThrow('案件已結案，無法重新派發');
      });
    });

    describe('updateCaseStatus()', () => {
      it('應該允許有效的狀態轉換', async () => {
        await caseFlowService.assignCase(testCase.caseId, { assignedTo: 'team1' });

        const result = await caseFlowService.updateCaseStatus(
          testCase.caseId,
          'IN_PROGRESS',
          'officer123'
        );

        expect(result.status).toBe('IN_PROGRESS');
        expect(result.updatedBy).toBe('officer123');
      });

      it('應該拒絕無效的狀態轉換', async () => {
        await expect(caseFlowService.updateCaseStatus(testCase.caseId, 'CLOSED', 'officer123'))
          .rejects.toThrow('無效的狀態轉換');
      });

      it('應該記錄每次狀態更新', async () => {
        // Clear previous audit calls from case creation
        mockAuditService.log.mockClear();

        await caseFlowService.updateCaseStatus(testCase.caseId, 'ASSIGNED', 'officer123');

        expect(mockAuditService.log).toHaveBeenCalledWith({
          action: 'STATUS_UPDATED',
          caseId: testCase.caseId,
          userId: 'officer123',
          from: 'CREATED',
          to: 'ASSIGNED',
          timestamp: expect.any(Date)
        });
      });
    });

    describe('closeCase()', () => {
      it('應該成功結案並設定結案原因', async () => {
        const closureData = {
          closedBy: 'officer456',
          reason: 'PERSON_FOUND',
          resolution: '失蹤人員已安全尋回',
          location: '新竹市東區公園路'
        };

        const result = await caseFlowService.closeCase(testCase.caseId, closureData);

        expect(result.status).toBe('CLOSED');
        expect(result.closedBy).toBe('officer456');
        expect(result.closureReason).toBe('PERSON_FOUND');
        expect(result.closedAt).toBeInstanceOf(Date);
      });

      it('應該觸發資料清理流程', async () => {
        await caseFlowService.closeCase(testCase.caseId, {
          closedBy: 'admin',
          reason: 'RESOLVED'
        });

        expect(caseFlowService.scheduleDataRetention).toHaveBeenCalledWith(testCase.caseId);
      });
    });
  });

  describe('3. 多機關協調 (Multi-Agency Coordination)', () => {
    describe('assignMultipleAgencies()', () => {
      it('應該同時派發給警察、消防、醫療單位', async () => {
        const caseData = {
          type: 'TRAFFIC_ACCIDENT',
          title: '中華路重大車禍',
          severity: 'CRITICAL'
        };

        const testCase = await caseFlowService.createCase(caseData, 'dispatch001');

        const agencies = [
          { agency: 'POLICE', team: 'patrol_unit_3', contact: 'police@hccg.gov.tw' },
          { agency: 'FIRE', team: 'fire_station_2', contact: 'fire@hccg.gov.tw' },
          { agency: 'MEDICAL', team: 'ambulance_7', contact: 'medical@hccg.gov.tw' }
        ];

        const result = await caseFlowService.assignMultipleAgencies(testCase.caseId, agencies);

        expect(result.assignedAgencies).toHaveLength(3);
        expect(result.coordinationMode).toBe('MULTI_AGENCY');
        expect(result.leadAgency).toBe('POLICE'); // 預設主導機關
      });

      it('應該建立機關間通訊頻道', async () => {
        const testCase = await caseFlowService.createCase({ type: 'EMERGENCY' }, 'user1');
        const agencies = [
          { agency: 'POLICE', team: 'team1' },
          { agency: 'FIRE', team: 'team2' }
        ];

        await caseFlowService.assignMultipleAgencies(testCase.caseId, agencies);

        expect(mockNotificationService.createCommunicationChannel).toHaveBeenCalledWith({
          caseId: testCase.caseId,
          participants: ['team1', 'team2'],
          type: 'MULTI_AGENCY'
        });
      });

      it('應該設定機關協調會議時間', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MAJOR_INCIDENT' }, 'commander');
        const agencies = [
          { agency: 'POLICE' },
          { agency: 'FIRE' },
          { agency: 'MEDICAL' }
        ];

        const result = await caseFlowService.assignMultipleAgencies(testCase.caseId, agencies);

        expect(result.coordinationMeeting).toBeDefined();
        expect(result.coordinationMeeting.scheduledAt).toBeInstanceOf(Date);
        expect(result.coordinationMeeting.participants).toHaveLength(3);
      });
    });

    describe('updateAgencyStatus()', () => {
      it('應該更新個別機關的處理狀態', async () => {
        const testCase = await caseFlowService.createCase({ type: 'RESCUE' }, 'ops');
        await caseFlowService.assignMultipleAgencies(testCase.caseId, [
          { agency: 'POLICE' }, { agency: 'FIRE' }
        ]);

        const result = await caseFlowService.updateAgencyStatus(
          testCase.caseId,
          'POLICE',
          'ARRIVED_ON_SCENE'
        );

        expect(result.agencyStatuses.POLICE).toBe('ARRIVED_ON_SCENE');
        expect(result.agencyStatuses.FIRE).toBe('ASSIGNED'); // 其他機關狀態不變
      });

      it('應該自動計算整體案件進度', async () => {
        const testCase = await caseFlowService.createCase({ type: 'RESCUE' }, 'ops');
        await caseFlowService.assignMultipleAgencies(testCase.caseId, [
          { agency: 'POLICE' }, { agency: 'FIRE' }
        ]);

        await caseFlowService.updateAgencyStatus(testCase.caseId, 'POLICE', 'COMPLETED');
        const result = await caseFlowService.updateAgencyStatus(testCase.caseId, 'FIRE', 'IN_PROGRESS');

        expect(result.overallProgress).toBe(50); // 1/2 完成
      });
    });
  });

  describe('4. 即時狀態更新與通知 (Real-time Updates)', () => {
    describe('broadcastCaseUpdate()', () => {
      it('應該向所有相關人員廣播案件更新', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        const update = {
          type: 'LOCATION_UPDATE',
          data: {
            latitude: 24.8,
            longitude: 120.97,
            description: '目擊者於新竹火車站發現疑似失蹤人員'
          }
        };

        await caseFlowService.broadcastCaseUpdate(testCase.caseId, update);

        expect(mockNotificationService.broadcast).toHaveBeenCalledWith({
          caseId: testCase.caseId,
          updateType: 'LOCATION_UPDATE',
          recipients: 'ALL_ASSIGNED',
          priority: 'NORMAL'
        });
      });

      it('應該支援緊急廣播模式', async () => {
        const testCase = await caseFlowService.createCase({ type: 'EMERGENCY' }, 'user1');

        const emergencyUpdate = {
          type: 'EMERGENCY_ESCALATION',
          data: { message: '情況急轉直下，需要立即支援' },
          priority: 'CRITICAL'
        };

        await caseFlowService.broadcastCaseUpdate(testCase.caseId, emergencyUpdate);

        expect(mockNotificationService.emergencyBroadcast).toHaveBeenCalledWith({
          caseId: testCase.caseId,
          message: '情況急轉直下，需要立即支援',
          priority: 'CRITICAL'
        });
      });
    });

    describe('subscribeToUpdates()', () => {
      it('應該允許用戶訂閱案件更新', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        const subscription = await caseFlowService.subscribeToUpdates(
          testCase.caseId,
          'officer123',
          ['STATUS_CHANGE', 'LOCATION_UPDATE']
        );

        expect(subscription.userId).toBe('officer123');
        expect(subscription.eventTypes).toContain('STATUS_CHANGE');
        expect(subscription.eventTypes).toContain('LOCATION_UPDATE');
      });

      it('應該支援即時 WebSocket 推送', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        await caseFlowService.subscribeToUpdates(testCase.caseId, 'officer456', ['ALL']);

        expect(mockNotificationService.createWebSocketSubscription).toHaveBeenCalledWith({
          caseId: testCase.caseId,
          userId: 'officer456',
          channel: `case_${testCase.caseId}`
        });
      });
    });
  });

  describe('5. 案件升級機制 (Case Escalation)', () => {
    describe('escalateCase()', () => {
      it('應該根據時間自動升級案件', async () => {
        const testCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          severity: 'MEDIUM',
          escalationRules: {
            timeThreshold: 60, // 60分鐘
            autoEscalate: true
          }
        }, 'user1');

        // 模擬60分鐘後
        jest.advanceTimersByTime(60 * 60 * 1000);

        const result = await caseFlowService.checkEscalation(testCase.caseId);

        expect(result.escalated).toBe(true);
        expect(result.escalationLevel).toBe('HIGH');
        expect(result.escalationReason).toBe('TIME_THRESHOLD_EXCEEDED');
      });

      it('應該根據嚴重程度升級案件', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        const escalationData = {
          reason: 'SEVERITY_INCREASE',
          newSeverity: 'CRITICAL',
          description: '發現失蹤人員有生命危險',
          escalatedBy: 'supervisor001'
        };

        const result = await caseFlowService.escalateCase(testCase.caseId, escalationData);

        expect(result.severity).toBe('CRITICAL');
        expect(result.escalationLevel).toBe('IMMEDIATE');
        expect(result.additionalResources).toContain('HELICOPTER');
      });

      it('應該自動分配額外資源', async () => {
        const testCase = await caseFlowService.createCase({ type: 'RESCUE' }, 'user1');

        await caseFlowService.escalateCase(testCase.caseId, {
          reason: 'RESOURCE_NEEDED',
          escalatedBy: 'commander'
        });

        const updatedCase = await caseFlowService.getCaseById(testCase.caseId);

        expect(updatedCase.assignedResources).toContain('SEARCH_AND_RESCUE_TEAM');
        expect(updatedCase.assignedResources).toContain('MEDICAL_HELICOPTER');
        expect(updatedCase.commandLevel).toBe('REGIONAL');
      });
    });

    describe('escalationTriggers', () => {
      it('應該在失蹤兒童案件自動升級', async () => {
        const childCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          missingPerson: { age: 7 },
          title: '新竹國小學童失蹤案'
        }, 'school_officer');

        expect(childCase.escalationLevel).toBe('IMMEDIATE');
        expect(childCase.autoEscalated).toBe(true);
        expect(childCase.escalationReason).toBe('MISSING_CHILD_AUTO_ESCALATION');
      });

      it('應該在多人失蹤案件自動升級', async () => {
        const massCase = await caseFlowService.createCase({
          type: 'MASS_CASUALTY',
          affectedPersons: 15,
          title: '新竹縣尖石鄉登山團失聯'
        }, 'mountain_rescue');

        expect(massCase.escalationLevel).toBe('REGIONAL');
        expect(massCase.commandLevel).toBe('CENTRAL');
        expect(massCase.assignedAgencies).toContain('COAST_GUARD');
      });
    });
  });

  describe('6. 搜尋區域管理 (Search Area Management)', () => {
    describe('defineSearchArea()', () => {
      it('應該建立搜尋區域並分配搜尋隊', async () => {
        const testCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          location: { latitude: 24.8, longitude: 120.97 }
        }, 'user1');

        const searchArea = {
          center: { latitude: 24.8, longitude: 120.97 },
          radius: 2000, // 2公里
          zones: [
            { id: 'zone_a', priority: 'HIGH', terrain: 'URBAN' },
            { id: 'zone_b', priority: 'MEDIUM', terrain: 'PARK' },
            { id: 'zone_c', priority: 'LOW', terrain: 'RESIDENTIAL' }
          ]
        };

        const result = await caseFlowService.defineSearchArea(testCase.caseId, searchArea);

        expect(result.searchArea.zones).toHaveLength(3);
        expect(result.searchArea.totalArea).toBeCloseTo(12.57, 1); // π * 2²
        expect(result.searchStrategy).toBe('CONCENTRIC_CIRCLES');
      });

      it('應該根據地形自動分配適當的搜尋隊', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        const mountainArea = {
          center: { latitude: 24.7, longitude: 121.2 },
          radius: 5000,
          terrain: 'MOUNTAIN',
          difficulty: 'HIGH'
        };

        const result = await caseFlowService.defineSearchArea(testCase.caseId, mountainArea);

        expect(result.assignedTeams).toContain('MOUNTAIN_RESCUE_TEAM');
        expect(result.assignedTeams).toContain('HELICOPTER_UNIT');
        expect(result.specialEquipment).toContain('CLIMBING_GEAR');
      });

      it('應該計算搜尋時間預估', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        const searchArea = {
          center: { latitude: 24.8, longitude: 120.97 },
          radius: 1000,
          teamCount: 4,
          terrain: 'URBAN'
        };

        const result = await caseFlowService.defineSearchArea(testCase.caseId, searchArea);

        expect(result.estimatedSearchTime).toBeGreaterThan(0);
        expect(result.estimatedCompletionTime).toBeInstanceOf(Date);
        expect(result.resourceRequirements.personnel).toBeGreaterThan(0);
      });
    });

    describe('assignZoneToTeam()', () => {
      it('應該分配搜尋區域給特定隊伍', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
        await caseFlowService.defineSearchArea(testCase.caseId, {
          zones: [{ id: 'zone_1', priority: 'HIGH' }]
        });

        const assignment = {
          zoneId: 'zone_1',
          teamId: 'search_team_alpha',
          estimatedTime: 120,
          specialInstructions: '注意溪流區域安全'
        };

        const result = await caseFlowService.assignZoneToTeam(testCase.caseId, assignment);

        expect(result.zoneAssignments.zone_1.assignedTeam).toBe('search_team_alpha');
        expect(result.zoneAssignments.zone_1.status).toBe('ASSIGNED');
        expect(result.zoneAssignments.zone_1.estimatedCompletionTime).toBeInstanceOf(Date);
      });

      it('應該追蹤搜尋進度', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
        await caseFlowService.defineSearchArea(testCase.caseId, {
          zones: [{ id: 'zone_1' }]
        });

        await caseFlowService.assignZoneToTeam(testCase.caseId, {
          zoneId: 'zone_1',
          teamId: 'team_1'
        });

        const progress = await caseFlowService.updateSearchProgress(testCase.caseId, 'zone_1', {
          completionPercentage: 75,
          findings: ['發現腳印', '發現個人物品'],
          teamLeaderReport: '搜尋順利進行中'
        });

        expect(progress.zones.zone_1.completionPercentage).toBe(75);
        expect(progress.zones.zone_1.findings).toHaveLength(2);
        expect(progress.overallProgress).toBeGreaterThan(0);
      });
    });
  });

  describe('7. 志工派遣協調 (Volunteer Dispatch)', () => {
    describe('requestVolunteers()', () => {
      it('應該根據需求請求志工支援', async () => {
        const testCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          location: { latitude: 24.8, longitude: 120.97 }
        }, 'user1');

        const volunteerRequest = {
          skillsRequired: ['SEARCH_AND_RESCUE', 'FIRST_AID'],
          numberOfVolunteers: 10,
          duration: 240, // 4小時
          meetingPoint: '新竹市消防局',
          briefingTime: new Date(Date.now() + 30 * 60 * 1000) // 30分鐘後
        };

        const result = await caseFlowService.requestVolunteers(testCase.caseId, volunteerRequest);

        expect(result.volunteerRequest.status).toBe('ACTIVE');
        expect(result.volunteerRequest.skillsRequired).toContain('SEARCH_AND_RESCUE');
        expect(result.estimatedResponseTime).toBeGreaterThan(0);
      });

      it('應該通知合格的志工', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        await caseFlowService.requestVolunteers(testCase.caseId, {
          skillsRequired: ['MOUNTAIN_RESCUE'],
          numberOfVolunteers: 5
        });

        expect(mockNotificationService.notifyQualifiedVolunteers).toHaveBeenCalledWith({
          caseId: testCase.caseId,
          skills: ['MOUNTAIN_RESCUE'],
          location: expect.any(Object),
          urgency: 'NORMAL'
        });
      });

      it('應該管理志工報到和分組', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
        await caseFlowService.requestVolunteers(testCase.caseId, { numberOfVolunteers: 8 });

        const volunteers = [
          { id: 'vol_001', name: '張○○', skills: ['SEARCH_AND_RESCUE'] },
          { id: 'vol_002', name: '李○○', skills: ['FIRST_AID'] },
          { id: 'vol_003', name: '王○○', skills: ['COMMUNICATION'] }
        ];

        const result = await caseFlowService.assignVolunteers(testCase.caseId, volunteers);

        expect(result.volunteerGroups).toBeDefined();
        expect(result.volunteerGroups.search_team.members).toContain('vol_001');
        expect(result.volunteerGroups.medical_team.members).toContain('vol_002');
        expect(result.volunteerGroups.communication_team.members).toContain('vol_003');
      });
    });

    describe('manageVolunteerSafety()', () => {
      it('應該追蹤志工安全狀態', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
        await caseFlowService.assignVolunteers(testCase.caseId, [
          { id: 'vol_001', name: '張○○' }
        ]);

        const safetyCheck = {
          volunteerId: 'vol_001',
          location: { latitude: 24.8, longitude: 120.97 },
          status: 'SAFE',
          lastContact: new Date()
        };

        const result = await caseFlowService.updateVolunteerSafety(testCase.caseId, safetyCheck);

        expect(result.volunteerSafety.vol_001.status).toBe('SAFE');
        expect(result.volunteerSafety.vol_001.lastContact).toBeInstanceOf(Date);
      });

      it('應該在志工失聯時發出警告', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
        await caseFlowService.assignVolunteers(testCase.caseId, [{ id: 'vol_001' }]);

        // 模擬志工失聯超過檢查間隔
        jest.advanceTimersByTime(90 * 60 * 1000); // 90分鐘

        const result = await caseFlowService.checkVolunteerSafety(testCase.caseId);

        expect(result.alerts).toContain('VOLUNTEER_OVERDUE');
        expect(mockNotificationService.sendVolunteerAlert).toHaveBeenCalledWith({
          volunteerId: 'vol_001',
          alertType: 'OVERDUE_CHECK_IN',
          caseId: testCase.caseId
        });
      });
    });
  });

  describe('8. 案件解決與結案流程 (Case Resolution)', () => {
    describe('resolveCase()', () => {
      it('應該記錄案件解決詳情', async () => {
        const testCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          missingPerson: { name: '陳○○' }
        }, 'user1');

        const resolution = {
          outcome: 'PERSON_FOUND_SAFE',
          location: '新竹市東區公園路100號',
          foundBy: 'search_team_alpha',
          condition: 'HEALTHY',
          details: '失蹤人員在親友家中找到，身體健康',
          resolvedBy: 'officer456',
          involvedAgencies: ['POLICE', 'FIRE'],
          totalResourcesUsed: {
            personnel: 25,
            vehicles: 6,
            duration: 180 // 分鐘
          }
        };

        const result = await caseFlowService.resolveCase(testCase.caseId, resolution);

        expect(result.status).toBe('RESOLVED');
        expect(result.resolution.outcome).toBe('PERSON_FOUND_SAFE');
        expect(result.resolution.resolvedAt).toBeInstanceOf(Date);
        expect(result.resolution.totalCost).toBeGreaterThan(0);
      });

      it('應該生成案件摘要報告', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        const resolution = {
          outcome: 'PERSON_FOUND_SAFE',
          resolvedBy: 'officer123'
        };

        await caseFlowService.resolveCase(testCase.caseId, resolution);

        const report = await caseFlowService.generateCaseSummary(testCase.caseId);

        expect(report).toHaveProperty('caseOverview');
        expect(report).toHaveProperty('timeline');
        expect(report).toHaveProperty('resourcesUsed');
        expect(report).toHaveProperty('lessonsLearned');
        expect(report).toHaveProperty('recommendations');
      });

      it('應該觸發後續處理流程', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        await caseFlowService.resolveCase(testCase.caseId, {
          outcome: 'PERSON_FOUND_SAFE',
          resolvedBy: 'officer789'
        });

        expect(caseFlowService.initiateFamilyNotification).toHaveBeenCalledWith(testCase.caseId);
        expect(caseFlowService.scheduleDebriefing).toHaveBeenCalledWith(testCase.caseId);
        expect(caseFlowService.updateStatistics).toHaveBeenCalledWith(testCase.caseId);
      });
    });

    describe('案件關閉後處理', () => {
      it('應該安排資料保留和清理', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
        await caseFlowService.resolveCase(testCase.caseId, { outcome: 'RESOLVED' });

        await caseFlowService.closeCase(testCase.caseId, { closedBy: 'admin' });

        expect(caseFlowService.scheduleDataRetention).toHaveBeenCalledWith(testCase.caseId);
      });

      it('應該更新相關統計和KPI', async () => {
        const testCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          severity: 'HIGH'
        }, 'user1');

        await caseFlowService.resolveCase(testCase.caseId, {
          outcome: 'PERSON_FOUND_SAFE',
          responseTime: 120 // 分鐘
        });

        expect(caseFlowService.updateKPIMetrics).toHaveBeenCalledWith({
          caseType: 'MISSING_PERSON',
          severity: 'HIGH',
          responseTime: 120,
          outcome: 'PERSON_FOUND_SAFE',
          successful: true
        });
      });
    });
  });

  describe('9. 效能指標追蹤 (Performance Metrics)', () => {
    describe('trackResponseTime()', () => {
      it('應該記錄各階段響應時間', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        // Advance time by 100ms
        jest.advanceTimersByTime(100);
        await caseFlowService.assignCase(testCase.caseId, { assignedTo: 'team1' });

        // Advance time by another 100ms
        jest.advanceTimersByTime(100);
        await caseFlowService.updateCaseStatus(testCase.caseId, 'IN_PROGRESS', 'officer1');

        const metrics = await caseFlowService.getCaseMetrics(testCase.caseId);

        expect(metrics.responseTime.toAssignment).toBeGreaterThanOrEqual(100);
        expect(metrics.responseTime.toInProgress).toBeGreaterThanOrEqual(200);
        expect(metrics.responseTime.total).toBeGreaterThanOrEqual(0);
      });

      it('應該計算平均響應時間', async () => {
        const cases = [];
        for (let i = 0; i < 5; i++) {
          const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');
          await caseFlowService.resolveCase(testCase.caseId, {
            outcome: 'RESOLVED',
            responseTime: (i + 1) * 60 // 60, 120, 180, 240, 300 分鐘
          });
          cases.push(testCase);
        }

        const avgMetrics = await caseFlowService.getAverageResponseTime('MISSING_PERSON');

        expect(avgMetrics.averageResponseTime).toBe(180); // (60+120+180+240+300)/5
        expect(avgMetrics.medianResponseTime).toBe(180);
        expect(avgMetrics.sampleSize).toBe(5);
      });
    });

    describe('trackResourceUtilization()', () => {
      it('應該追蹤資源使用效率', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

        await caseFlowService.assignMultipleAgencies(testCase.caseId, [
          { agency: 'POLICE', personnel: 8 },
          { agency: 'FIRE', personnel: 6 },
          { agency: 'MEDICAL', personnel: 4 }
        ]);

        await caseFlowService.resolveCase(testCase.caseId, {
          outcome: 'PERSON_FOUND_SAFE',
          duration: 240, // 4小時
          resourceEfficiency: 'HIGH'
        });

        const utilization = await caseFlowService.getResourceUtilization(testCase.caseId);

        expect(utilization.totalPersonnel).toBe(18);
        expect(utilization.totalHours).toBe(72); // 18人 × 4小時
        expect(utilization.efficiency).toBe('HIGH');
        expect(utilization.costEffectiveness).toBeGreaterThan(0);
      });
    });

    describe('generatePerformanceReport()', () => {
      it('應該生成效能分析報告', async () => {
        // 建立多個測試案件
        const cases = [];
        for (let i = 0; i < 10; i++) {
          const testCase = await caseFlowService.createCase({
            type: i % 2 === 0 ? 'MISSING_PERSON' : 'TRAFFIC_ACCIDENT',
            severity: i % 3 === 0 ? 'HIGH' : 'MEDIUM'
          }, 'user1');
          await caseFlowService.resolveCase(testCase.caseId, { outcome: 'RESOLVED' });
          cases.push(testCase);
        }

        const report = await caseFlowService.generatePerformanceReport({
          period: 'LAST_30_DAYS',
          caseTypes: ['MISSING_PERSON', 'TRAFFIC_ACCIDENT'],
          metrics: ['RESPONSE_TIME', 'RESOURCE_EFFICIENCY', 'SUCCESS_RATE']
        });

        expect(report.summary.totalCases).toBe(10);
        expect(report.summary.successRate).toBeGreaterThan(0);
        expect(report.breakdown.byType).toHaveProperty('MISSING_PERSON');
        expect(report.breakdown.byType).toHaveProperty('TRAFFIC_ACCIDENT');
        expect(report.trends.responseTime).toBeDefined();
      });
    });
  });

  describe('10. 班別交接 (Shift Handoff)', () => {
    describe('prepareShiftHandoff()', () => {
      it('應該準備班別交接資料', async () => {
        const activeCases = [];
        for (let i = 0; i < 3; i++) {
          const testCase = await caseFlowService.createCase({
            type: 'MISSING_PERSON',
            title: `進行中案件 ${i + 1}`,
            status: 'IN_PROGRESS'
          }, 'officer_day_shift');
          activeCases.push(testCase);
        }

        const handoffData = await caseFlowService.prepareShiftHandoff({
          outgoingShift: 'DAY_SHIFT',
          incomingShift: 'NIGHT_SHIFT',
          handoffTime: new Date(),
          preparedBy: 'supervisor_day'
        });

        expect(handoffData.activeCases).toHaveLength(3);
        expect(handoffData.priorityCases).toBeDefined();
        expect(handoffData.resourceStatus).toBeDefined();
        expect(handoffData.pendingActions).toBeDefined();
      });

      it('應該標識需要特別關注的案件', async () => {
        const criticalCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          severity: 'CRITICAL',
          escalationLevel: 'IMMEDIATE',
          missingPerson: { age: 6 }
        }, 'officer1');

        const handoffData = await caseFlowService.prepareShiftHandoff({
          outgoingShift: 'DAY_SHIFT',
          incomingShift: 'NIGHT_SHIFT'
        });

        const priorityCase = handoffData.priorityCases.find(c => c.caseId === criticalCase.caseId);
        expect(priorityCase).toBeDefined();
        expect(priorityCase.priority).toBe('CRITICAL');
        expect(priorityCase.specialInstructions).toContain('MISSING_CHILD');
      });

      it('應該生成交接檢查清單', async () => {
        const handoffData = await caseFlowService.prepareShiftHandoff({
          outgoingShift: 'EVENING_SHIFT',
          incomingShift: 'NIGHT_SHIFT'
        });

        expect(handoffData.checklist).toContain('確認所有進行中案件狀態');
        expect(handoffData.checklist).toContain('檢查緊急聯絡名單');
        expect(handoffData.checklist).toContain('確認可用資源清單');
        expect(handoffData.checklist).toContain('檢查待處理警報');
      });
    });

    describe('executeShiftHandoff()', () => {
      it('應該執行班別交接並記錄確認', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'day_officer');

        const handoffExecution = {
          outgoingOfficer: 'day_supervisor',
          incomingOfficer: 'night_supervisor',
          handoffTime: new Date(),
          caseTransfers: [
            {
              caseId: testCase.caseId,
              transferredTo: 'night_supervisor',
              specialNotes: '需要持續監控搜尋進度'
            }
          ]
        };

        const result = await caseFlowService.executeShiftHandoff(handoffExecution);

        expect(result.status).toBe('COMPLETED');
        expect(result.transferredCases).toHaveLength(1);
        expect(result.confirmations.outgoing).toBe(true);
        expect(result.confirmations.incoming).toBe(true);
      });

      it('應該更新案件負責人', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'day_officer');

        await caseFlowService.executeShiftHandoff({
          caseTransfers: [{
            caseId: testCase.caseId,
            transferredTo: 'night_officer'
          }]
        });

        const updatedCase = await caseFlowService.getCaseById(testCase.caseId);
        expect(updatedCase.currentResponsible).toBe('night_officer');
        expect(updatedCase.handoffHistory).toHaveLength(1);
      });
    });
  });

  describe('11. 緊急升級觸發器 (Emergency Escalation Triggers)', () => {
    describe('automaticEscalationTriggers', () => {
      it('應該在兒童失蹤時立即觸發最高級別警報', async () => {
        const childCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          missingPerson: {
            name: '小明',
            age: 5,
            gender: 'MALE'
          },
          location: { latitude: 24.8, longitude: 120.97 }
        }, 'school_officer');

        expect(childCase.emergencyLevel).toBe('AMBER_ALERT');
        expect(childCase.escalationTriggers).toContain('MISSING_CHILD_UNDER_12');
        expect(childCase.autoNotifications).toContain('MEDIA_ALERT');
        expect(childCase.autoNotifications).toContain('PUBLIC_BROADCAST');
      });

      it('應該在大量傷亡事件時啟動災害應變機制', async () => {
        const massIncident = await caseFlowService.createCase({
          type: 'MASS_CASUALTY',
          title: '新竹縣尖石鄉土石流災害',
          affectedPersons: 50,
          severity: 'CRITICAL',
          location: { latitude: 24.7, longitude: 121.2 }
        }, 'emergency_command');

        expect(massIncident.emergencyLevel).toBe('DISASTER_RESPONSE');
        expect(massIncident.activatedProtocols).toContain('CENTRAL_EMERGENCY_RESPONSE');
        expect(massIncident.commandLevel).toBe('CENTRAL');
        expect(massIncident.autoEscalatedTo).toContain('DISASTER_RESPONSE_CENTER');
      });

      it('應該在恐怖攻擊疑慮時啟動反恐機制', async () => {
        const securityThreat = await caseFlowService.createCase({
          type: 'SECURITY_THREAT',
          title: '新竹火車站可疑爆裂物',
          threatLevel: 'HIGH',
          publicSafety: 'IMMEDIATE_DANGER'
        }, 'security_officer');

        expect(securityThreat.emergencyLevel).toBe('NATIONAL_SECURITY');
        expect(securityThreat.activatedProtocols).toContain('ANTI_TERRORISM');
        expect(securityThreat.autoNotifications).toContain('NATIONAL_SECURITY_BUREAU');
        expect(securityThreat.evacuationRequired).toBe(true);
      });
    });

    describe('escalationChain', () => {
      it('應該依序通知升級鏈中的相關人員', async () => {
        const testCase = await caseFlowService.createCase({
          type: 'MISSING_PERSON',
          severity: 'MEDIUM'
        }, 'officer1');

        const escalation = await caseFlowService.triggerEscalationChain(testCase.caseId, {
          trigger: 'TIME_EXCEEDED',
          level: 'SUPERVISOR'
        });

        expect(escalation.notifiedPersonnel).toContain('shift_supervisor');
        expect(escalation.escalationLevel).toBe('SUPERVISOR');
        expect(escalation.nextEscalationTime).toBeInstanceOf(Date);
      });

      it('應該在連續升級後啟動指揮官級別響應', async () => {
        const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'officer1');

        // 第一級升級
        await caseFlowService.triggerEscalationChain(testCase.caseId, { level: 'SUPERVISOR' });

        // 第二級升級
        await caseFlowService.triggerEscalationChain(testCase.caseId, { level: 'COMMANDER' });

        const finalCase = await caseFlowService.getCaseById(testCase.caseId);

        expect(finalCase.commandLevel).toBe('REGIONAL');
        expect(finalCase.activatedProtocols).toContain('INCIDENT_COMMAND_SYSTEM');
        expect(finalCase.autoAssignedResources).toContain('MOBILE_COMMAND_UNIT');
      });
    });

    describe('publicSafetyTriggers', () => {
      it('應該在公共安全威脅時發布緊急警報', async () => {
        const publicThreat = await caseFlowService.createCase({
          type: 'PUBLIC_SAFETY_THREAT',
          title: '新竹市區化學品洩漏',
          threatType: 'CHEMICAL_HAZARD',
          affectedArea: {
            center: { latitude: 24.8, longitude: 120.97 },
            radius: 1000
          }
        }, 'hazmat_team');

        expect(publicThreat.emergencyLevel).toBe('PUBLIC_WARNING');
        expect(publicThreat.autoNotifications).toContain('EMERGENCY_BROADCAST_SYSTEM');
        expect(publicThreat.autoNotifications).toContain('CELL_BROADCAST_ALERT');
        expect(publicThreat.evacuationZones).toBeDefined();
      });

      it('應該協調多機關緊急應變', async () => {
        const multiAgencyEmergency = await caseFlowService.createCase({
          type: 'INDUSTRIAL_ACCIDENT',
          title: '新竹科學園區火災',
          severity: 'CRITICAL'
        }, 'fire_commander');

        expect(multiAgencyEmergency.coordinatedAgencies).toContain('FIRE_DEPARTMENT');
        expect(multiAgencyEmergency.coordinatedAgencies).toContain('POLICE');
        expect(multiAgencyEmergency.coordinatedAgencies).toContain('ENVIRONMENTAL_PROTECTION');
        expect(multiAgencyEmergency.coordinatedAgencies).toContain('LABOR_SAFETY');
      });
    });
  });

  describe('錯誤處理和邊緣案例 (Error Handling & Edge Cases)', () => {
    it('應該拒絕無效的案件類型', async () => {
      await expect(caseFlowService.createCase({
        type: 'INVALID_TYPE',
        title: '無效案件'
      }, 'user1')).rejects.toThrow('不支援的案件類型');
    });

    it('應該處理並發案件建立', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        caseFlowService.createCase({
          type: 'MISSING_PERSON',
          title: `並發案件 ${i + 1}`
        }, `user_${i + 1}`)
      );

      const results = await Promise.all(promises);
      const caseNumbers = results.map(r => r.caseNumber);
      const uniqueNumbers = new Set(caseNumbers);

      expect(uniqueNumbers.size).toBe(10); // 所有案件編號都是唯一的
    });

    it('應該處理系統資源不足的情況', async () => {
      const testCase = await caseFlowService.createCase({ type: 'MISSING_PERSON' }, 'user1');

      // 模擬所有搜救隊都已派遣
      mockRbacService.getAvailableResources.mockResolvedValue({
        searchTeams: [],
        volunteers: 0,
        vehicles: 0
      });

      const result = await caseFlowService.assignCase(testCase.caseId, {
        assignedTo: 'search_team',
        requiresResources: true
      });

      expect(result.warnings).toContain('INSUFFICIENT_RESOURCES');
      expect(result.escalationRecommended).toBe(true);
    });

    it('應該在權限不足時拒絕操作', async () => {
      mockRbacService.hasPermission.mockResolvedValue(false);

      await expect(caseFlowService.createCase({
        type: 'MISSING_PERSON',
        title: '無權限案件'
      }, 'unauthorized_user')).rejects.toThrow('權限不足');
    });
  });
});