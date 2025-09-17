/**
 * KPI 服務測試套件 (KPI Service Test Suite)
 *
 * 測試範圍:
 * 1. 即時 KPI 計算與聚合
 * 2. 案件解決指標 (回應時間、成功率)
 * 3. 志工績效指標
 * 4. 系統效能指標
 * 5. 趨勢分析與預測
 * 6. 警報閾值與通知
 * 7. 儀表板資料準備
 * 8. 自訂 KPI 定義
 *
 * @file kpi.service.test.js
 * @requires KpiService - 尚未實作，測試將失敗 (RED Phase)
 */

const KpiService = require('../../src/services/kpi.service');
const { ValidationError, CalculationError, ThresholdError } = require('../../src/utils/errors');

describe('KPI 服務 (KPI Service)', () => {
  let kpiService;
  let mockDatabase;
  let mockAggregator;
  let mockTimeSeriesDB;
  let mockNotificationService;
  let mockMLService;
  let mockCacheService;

  beforeEach(() => {
    // Mock dependencies
    mockDatabase = {
      query: jest.fn(),
      aggregate: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn()
    };

    mockAggregator = {
      sum: jest.fn(),
      average: jest.fn(),
      percentile: jest.fn(),
      standardDeviation: jest.fn(),
      groupBy: jest.fn()
    };

    mockTimeSeriesDB = {
      insert: jest.fn(),
      query: jest.fn(),
      aggregate: jest.fn(),
      downsample: jest.fn()
    };

    mockNotificationService = {
      sendAlert: jest.fn(),
      sendThresholdWarning: jest.fn(),
      sendPerformanceReport: jest.fn()
    };

    mockMLService = {
      predict: jest.fn(),
      trainModel: jest.fn(),
      detectAnomalies: jest.fn()
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn()
    };

    kpiService = new KpiService({
      database: mockDatabase,
      aggregator: mockAggregator,
      timeSeriesDB: mockTimeSeriesDB,
      notificationService: mockNotificationService,
      mlService: mockMLService,
      cacheService: mockCacheService
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('即時 KPI 計算與聚合 (Real-time KPI Calculation)', () => {
    test('應計算案件處理即時統計', async () => {
      const timeWindow = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const mockCaseData = [
        { id: 'case-001', status: '已結案', responseTime: 15, priority: '緊急' },
        { id: 'case-002', status: '處理中', responseTime: 8, priority: '一般' },
        { id: 'case-003', status: '已結案', responseTime: 25, priority: '緊急' }
      ];

      mockDatabase.query.mockResolvedValue(mockCaseData);
      mockAggregator.average.mockReturnValue(16);
      mockAggregator.sum.mockReturnValue(3);

      const realTimeKpi = await kpiService.calculateRealTimeKPI('CASE_PROCESSING', timeWindow);

      expect(realTimeKpi).toHaveProperty('metric', 'CASE_PROCESSING');
      expect(realTimeKpi).toHaveProperty('totalCases', 3);
      expect(realTimeKpi).toHaveProperty('averageResponseTime', 16);
      expect(realTimeKpi).toHaveProperty('closedCases', 2);
      expect(realTimeKpi).toHaveProperty('timestamp');
    });

    test('應聚合多個地理區域的 KPI', async () => {
      const regionData = {
        regions: ['新竹市北區', '新竹市東區', '新竹市香山區'],
        timeframe: 'daily',
        date: '2024-01-01'
      };

      const mockRegionalData = [
        { region: '新竹市北區', casesHandled: 25, avgResponseTime: 12 },
        { region: '新竹市東區', casesHandled: 18, avgResponseTime: 15 },
        { region: '新竹市香山區', casesHandled: 12, avgResponseTime: 10 }
      ];

      mockDatabase.aggregate.mockResolvedValue(mockRegionalData);

      const aggregatedKpi = await kpiService.aggregateRegionalKPI(regionData);

      expect(aggregatedKpi).toHaveProperty('totalRegions', 3);
      expect(aggregatedKpi).toHaveProperty('totalCases', 55);
      expect(aggregatedKpi).toHaveProperty('regionalBreakdown');
      expect(aggregatedKpi.regionalBreakdown).toHaveLength(3);
    });

    test('應計算分時段的 KPI 趨勢', async () => {
      const hourlyQuery = {
        metric: 'EMERGENCY_RESPONSE',
        date: '2024-01-01',
        granularity: 'hourly'
      };

      const mockHourlyData = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        emergencyCalls: Math.floor(Math.random() * 10) + 1,
        responseTime: Math.floor(Math.random() * 20) + 5,
        successRate: 0.85 + Math.random() * 0.15
      }));

      mockTimeSeriesDB.query.mockResolvedValue(mockHourlyData);

      const hourlyTrend = await kpiService.calculateHourlyTrend(hourlyQuery);

      expect(hourlyTrend).toHaveProperty('metric', 'EMERGENCY_RESPONSE');
      expect(hourlyTrend).toHaveProperty('dataPoints');
      expect(hourlyTrend.dataPoints).toHaveLength(24);
      expect(hourlyTrend.dataPoints[0]).toHaveProperty('hour');
      expect(hourlyTrend.dataPoints[0]).toHaveProperty('emergencyCalls');
    });

    test('應支援即時 KPI 更新推送', async () => {
      const kpiUpdate = {
        metric: 'VOLUNTEER_ACTIVE_COUNT',
        value: 45,
        change: +3,
        timestamp: new Date()
      };

      mockCacheService.set.mockResolvedValue(true);
      const eventEmitter = { emit: jest.fn() };
      kpiService.setEventEmitter(eventEmitter);

      await kpiService.pushRealTimeUpdate(kpiUpdate);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'kpi:real_time:VOLUNTEER_ACTIVE_COUNT',
        expect.objectContaining({
          value: 45,
          change: 3
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('kpi_update', kpiUpdate);
    });

    test('應處理大量並發的 KPI 計算請求', async () => {
      const concurrentRequests = Array.from({ length: 50 }, (_, i) => ({
        metric: `METRIC_${i}`,
        timeWindow: { start: new Date(), end: new Date() }
      }));

      mockDatabase.query.mockResolvedValue([{ count: 100 }]);
      mockAggregator.sum.mockReturnValue(100);

      const results = await Promise.all(
        concurrentRequests.map(req => kpiService.calculateRealTimeKPI(req.metric, req.timeWindow))
      );

      expect(results).toHaveLength(50);
      expect(results.every(result => result.hasOwnProperty('timestamp'))).toBe(true);
    });
  });

  describe('案件解決指標 (Case Resolution Metrics)', () => {
    test('應計算平均案件回應時間', async () => {
      const responseTimeQuery = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        caseType: 'EMERGENCY',
        priority: 'HIGH'
      };

      const mockCaseData = [
        { caseId: 'case-001', responseTimeMinutes: 8, resolutionTimeHours: 2 },
        { caseId: 'case-002', responseTimeMinutes: 12, resolutionTimeHours: 1.5 },
        { caseId: 'case-003', responseTimeMinutes: 5, resolutionTimeHours: 3 }
      ];

      mockDatabase.query.mockResolvedValue(mockCaseData);
      mockAggregator.average.mockReturnValueOnce(8.33).mockReturnValueOnce(2.17);

      const responseMetrics = await kpiService.calculateResponseTimeMetrics(responseTimeQuery);

      expect(responseMetrics).toHaveProperty('averageResponseTimeMinutes', 8.33);
      expect(responseMetrics).toHaveProperty('averageResolutionTimeHours', 2.17);
      expect(responseMetrics).toHaveProperty('totalCases', 3);
      expect(responseMetrics).toHaveProperty('slaCompliance');
    });

    test('應計算案件成功解決率', async () => {
      const successRateQuery = {
        timeframe: 'monthly',
        year: 2024,
        month: 1,
        includePartialSuccess: false
      };

      const mockSuccessData = {
        totalCases: 150,
        successfulCases: 135,
        partialSuccessCases: 8,
        failedCases: 7,
        successCategories: {
          '立即解決': 45,
          '轉介成功': 60,
          '協調解決': 30
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockSuccessData]);

      const successRate = await kpiService.calculateSuccessRate(successRateQuery);

      expect(successRate).toHaveProperty('overallSuccessRate', 0.9); // 135/150
      expect(successRate).toHaveProperty('totalCases', 150);
      expect(successRate).toHaveProperty('successCategories');
      expect(successRate.successCategories).toHaveProperty('立即解決', 45);
    });

    test('應追蹤案件升級和降級模式', async () => {
      const escalationQuery = {
        timeRange: '過去30天',
        analysisType: 'escalation_pattern'
      };

      const mockEscalationData = [
        {
          caseId: 'case-001',
          originalPriority: '一般',
          finalPriority: '緊急',
          escalationTime: 45, // 分鐘
          escalationReason: '狀況惡化'
        },
        {
          caseId: 'case-002',
          originalPriority: '緊急',
          finalPriority: '一般',
          deEscalationTime: 30,
          deEscalationReason: '誤報'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockEscalationData);

      const escalationMetrics = await kpiService.analyzeEscalationPatterns(escalationQuery);

      expect(escalationMetrics).toHaveProperty('escalationRate');
      expect(escalationMetrics).toHaveProperty('deEscalationRate');
      expect(escalationMetrics).toHaveProperty('averageEscalationTime', 45);
      expect(escalationMetrics).toHaveProperty('commonEscalationReasons');
    });

    test('應計算不同優先級案件的 SLA 達成率', async () => {
      const slaQuery = {
        period: 'weekly',
        week: 1,
        year: 2024
      };

      const mockSlaData = {
        '緊急': { total: 25, slaCompliant: 23, targetMinutes: 15 },
        '高': { total: 45, slaCompliant: 42, targetMinutes: 30 },
        '中': { total: 80, slaCompliant: 75, targetMinutes: 60 },
        '低': { total: 50, slaCompliant: 48, targetMinutes: 240 }
      };

      mockDatabase.aggregate.mockResolvedValue([mockSlaData]);

      const slaMetrics = await kpiService.calculateSLACompliance(slaQuery);

      expect(slaMetrics).toHaveProperty('緊急');
      expect(slaMetrics['緊急']).toHaveProperty('complianceRate', 0.92); // 23/25
      expect(slaMetrics['緊急']).toHaveProperty('targetMinutes', 15);
    });

    test('應分析案件重新開啟率', async () => {
      const reopenQuery = {
        timeframe: 'quarterly',
        quarter: 1,
        year: 2024
      };

      const mockReopenData = {
        totalClosedCases: 500,
        reopenedCases: 25,
        reopenReasons: {
          '新資訊提供': 8,
          '問題復發': 12,
          '處理不當': 3,
          '當事人要求': 2
        },
        averageReopenTime: 72 // 小時
      };

      mockDatabase.aggregate.mockResolvedValue([mockReopenData]);

      const reopenMetrics = await kpiService.calculateReopenRate(reopenQuery);

      expect(reopenMetrics).toHaveProperty('reopenRate', 0.05); // 25/500
      expect(reopenMetrics).toHaveProperty('reopenReasons');
      expect(reopenMetrics.reopenReasons).toHaveProperty('問題復發', 12);
      expect(reopenMetrics).toHaveProperty('averageReopenTime', 72);
    });
  });

  describe('志工績效指標 (Volunteer Performance Metrics)', () => {
    test('應計算志工活躍度指標', async () => {
      const activityQuery = {
        timeframe: 'monthly',
        month: 1,
        year: 2024,
        region: '新竹市北區'
      };

      const mockVolunteerData = [
        {
          volunteerId: 'vol-001',
          name: '王志工',
          activeDays: 28,
          totalHours: 112,
          casesHandled: 45,
          rating: 4.8
        },
        {
          volunteerId: 'vol-002',
          name: '李志工',
          activeDays: 25,
          totalHours: 95,
          casesHandled: 38,
          rating: 4.6
        }
      ];

      mockDatabase.query.mockResolvedValue(mockVolunteerData);
      mockAggregator.average.mockReturnValueOnce(26.5).mockReturnValueOnce(103.5);

      const activityMetrics = await kpiService.calculateVolunteerActivity(activityQuery);

      expect(activityMetrics).toHaveProperty('totalVolunteers', 2);
      expect(activityMetrics).toHaveProperty('averageActiveDays', 26.5);
      expect(activityMetrics).toHaveProperty('averageHoursPerMonth', 103.5);
      expect(activityMetrics).toHaveProperty('topPerformers');
    });

    test('應追蹤志工回應時間', async () => {
      const responseQuery = {
        volunteerId: 'vol-001',
        period: 'last_30_days'
      };

      const mockResponseData = [
        { caseId: 'case-001', responseTimeMinutes: 5, assignedAt: new Date() },
        { caseId: 'case-002', responseTimeMinutes: 8, assignedAt: new Date() },
        { caseId: 'case-003', responseTimeMinutes: 3, assignedAt: new Date() }
      ];

      mockDatabase.query.mockResolvedValue(mockResponseData);
      mockAggregator.average.mockReturnValue(5.33);
      mockAggregator.percentile.mockReturnValue(8); // 90th percentile

      const responseMetrics = await kpiService.calculateVolunteerResponseTime(responseQuery);

      expect(responseMetrics).toHaveProperty('averageResponseTime', 5.33);
      expect(responseMetrics).toHaveProperty('percentile90', 8);
      expect(responseMetrics).toHaveProperty('totalCases', 3);
    });

    test('應計算志工滿意度評分', async () => {
      const satisfactionQuery = {
        timeframe: 'quarterly',
        quarter: 1,
        year: 2024
      };

      const mockSatisfactionData = [
        {
          volunteerId: 'vol-001',
          avgRating: 4.8,
          totalReviews: 25,
          feedbackCategories: {
            '專業度': 4.9,
            '響應速度': 4.7,
            '態度友善': 4.8
          }
        }
      ];

      mockDatabase.aggregate.mockResolvedValue(mockSatisfactionData);

      const satisfactionMetrics = await kpiService.calculateVolunteerSatisfaction(satisfactionQuery);

      expect(satisfactionMetrics).toHaveProperty('overallSatisfaction');
      expect(satisfactionMetrics).toHaveProperty('topRatedVolunteers');
      expect(satisfactionMetrics).toHaveProperty('feedbackAnalysis');
    });

    test('應分析志工培訓完成率', async () => {
      const trainingQuery = {
        trainingPeriod: '2024年第一季',
        courseType: 'mandatory'
      };

      const mockTrainingData = {
        totalVolunteers: 120,
        completedTraining: 108,
        inProgress: 8,
        notStarted: 4,
        trainingModules: {
          '基礎培訓': { completed: 115, required: 120 },
          '進階技能': { completed: 98, required: 120 },
          '法規更新': { completed: 105, required: 120 }
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockTrainingData]);

      const trainingMetrics = await kpiService.calculateTrainingCompletion(trainingQuery);

      expect(trainingMetrics).toHaveProperty('completionRate', 0.9); // 108/120
      expect(trainingMetrics).toHaveProperty('moduleBreakdown');
      expect(trainingMetrics.moduleBreakdown).toHaveProperty('基礎培訓');
    });

    test('應追蹤志工留任率', async () => {
      const retentionQuery = {
        cohortStartDate: '2023-01-01',
        analysisDate: '2024-01-01'
      };

      const mockRetentionData = {
        initialVolunteers: 150,
        activeVolunteers: 125,
        leftVolunteers: 25,
        retentionByQuarter: [
          { quarter: 'Q1', retentionRate: 0.95 },
          { quarter: 'Q2', retentionRate: 0.89 },
          { quarter: 'Q3', retentionRate: 0.85 },
          { quarter: 'Q4', retentionRate: 0.83 }
        ]
      };

      mockDatabase.aggregate.mockResolvedValue([mockRetentionData]);

      const retentionMetrics = await kpiService.calculateVolunteerRetention(retentionQuery);

      expect(retentionMetrics).toHaveProperty('overallRetentionRate', 0.833); // 125/150
      expect(retentionMetrics).toHaveProperty('quarterlyTrend');
      expect(retentionMetrics.quarterlyTrend).toHaveLength(4);
    });

    test('應計算志工工作負荷分佈', async () => {
      const workloadQuery = {
        period: 'current_month',
        includeOvertime: true
      };

      const mockWorkloadData = [
        { volunteerId: 'vol-001', activeCases: 12, hoursThisWeek: 35, overloadFlag: false },
        { volunteerId: 'vol-002', activeCases: 8, hoursThisWeek: 28, overloadFlag: false },
        { volunteerId: 'vol-003', activeCases: 18, hoursThisWeek: 45, overloadFlag: true }
      ];

      mockDatabase.query.mockResolvedValue(mockWorkloadData);

      const workloadMetrics = await kpiService.calculateWorkloadDistribution(workloadQuery);

      expect(workloadMetrics).toHaveProperty('averageCasesPerVolunteer');
      expect(workloadMetrics).toHaveProperty('overloadedVolunteers', 1);
      expect(workloadMetrics).toHaveProperty('workloadBalance');
    });
  });

  describe('系統效能指標 (System Performance Indicators)', () => {
    test('應監控 API 回應時間', async () => {
      const apiQuery = {
        timeframe: 'last_24_hours',
        endpoint: '/api/cases',
        includeErrors: true
      };

      const mockApiData = [
        { timestamp: new Date(), responseTime: 120, statusCode: 200 },
        { timestamp: new Date(), responseTime: 340, statusCode: 200 },
        { timestamp: new Date(), responseTime: 5000, statusCode: 500 }
      ];

      mockTimeSeriesDB.query.mockResolvedValue(mockApiData);
      mockAggregator.average.mockReturnValue(1820);
      mockAggregator.percentile.mockReturnValue(340);

      const apiMetrics = await kpiService.calculateAPIPerformance(apiQuery);

      expect(apiMetrics).toHaveProperty('averageResponseTime', 1820);
      expect(apiMetrics).toHaveProperty('p95ResponseTime', 340);
      expect(apiMetrics).toHaveProperty('errorRate');
      expect(apiMetrics).toHaveProperty('requestCount', 3);
    });

    test('應追蹤資料庫查詢效能', async () => {
      const dbQuery = {
        timeframe: 'hourly',
        hour: new Date().getHours()
      };

      const mockDbData = {
        slowQueries: [
          { query: 'SELECT * FROM cases WHERE...', executionTime: 2500, frequency: 15 },
          { query: 'UPDATE volunteers SET...', executionTime: 1800, frequency: 8 }
        ],
        averageQueryTime: 250,
        totalQueries: 1500,
        connectionPoolUsage: 0.75
      };

      mockDatabase.aggregate.mockResolvedValue([mockDbData]);

      const dbMetrics = await kpiService.calculateDatabasePerformance(dbQuery);

      expect(dbMetrics).toHaveProperty('averageQueryTime', 250);
      expect(dbMetrics).toHaveProperty('slowQueries');
      expect(dbMetrics).toHaveProperty('connectionPoolUsage', 0.75);
      expect(dbMetrics.slowQueries).toHaveLength(2);
    });

    test('應監控系統記憶體使用率', async () => {
      const memoryQuery = {
        timeframe: 'last_hour',
        granularity: 'minute'
      };

      const mockMemoryData = Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - (59 - i) * 60000),
        usedMemoryMB: 1500 + Math.random() * 500,
        totalMemoryMB: 4096,
        swapUsageMB: 100 + Math.random() * 50
      }));

      mockTimeSeriesDB.query.mockResolvedValue(mockMemoryData);

      const memoryMetrics = await kpiService.calculateMemoryUsage(memoryQuery);

      expect(memoryMetrics).toHaveProperty('averageUsagePercentage');
      expect(memoryMetrics).toHaveProperty('peakUsageMB');
      expect(memoryMetrics).toHaveProperty('memoryTrend');
      expect(memoryMetrics.memoryTrend).toHaveLength(60);
    });

    test('應追蹤同時連線使用者數量', async () => {
      const concurrentQuery = {
        timeframe: 'daily',
        date: '2024-01-01'
      };

      const mockConcurrentData = {
        peakConcurrentUsers: 250,
        averageConcurrentUsers: 180,
        hourlyBreakdown: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          concurrentUsers: 100 + Math.random() * 150
        }))
      };

      mockTimeSeriesDB.aggregate.mockResolvedValue([mockConcurrentData]);

      const concurrentMetrics = await kpiService.calculateConcurrentUsers(concurrentQuery);

      expect(concurrentMetrics).toHaveProperty('peakConcurrentUsers', 250);
      expect(concurrentMetrics).toHaveProperty('averageConcurrentUsers', 180);
      expect(concurrentMetrics).toHaveProperty('hourlyBreakdown');
      expect(concurrentMetrics.hourlyBreakdown).toHaveLength(24);
    });

    test('應監控儲存空間使用情況', async () => {
      const storageQuery = {
        includePrediction: true,
        timeHorizon: '3months'
      };

      const mockStorageData = {
        currentUsageGB: 250,
        totalCapacityGB: 1000,
        usageByCategory: {
          'audit_logs': 80,
          'case_data': 120,
          'system_backups': 50
        },
        growthRate: 15, // GB per month
        predictedUsageGB: 295
      };

      mockDatabase.aggregate.mockResolvedValue([mockStorageData]);

      const storageMetrics = await kpiService.calculateStorageUsage(storageQuery);

      expect(storageMetrics).toHaveProperty('usagePercentage', 0.25); // 250/1000
      expect(storageMetrics).toHaveProperty('usageByCategory');
      expect(storageMetrics).toHaveProperty('predictedUsageGB', 295);
    });
  });

  describe('趨勢分析與預測 (Trend Analysis and Forecasting)', () => {
    test('應分析案件數量趨勢', async () => {
      const trendQuery = {
        metric: 'case_volume',
        timeframe: 'monthly',
        lookbackMonths: 12,
        includeForecast: true
      };

      const mockTrendData = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        year: 2024,
        caseCount: 100 + Math.random() * 50,
        emergencyCases: 20 + Math.random() * 10
      }));

      mockDatabase.query.mockResolvedValue(mockTrendData);
      mockMLService.predict.mockResolvedValue({
        nextMonth: { predicted: 145, confidence: 0.85 },
        trend: 'increasing'
      });

      const trendAnalysis = await kpiService.analyzeCaseTrends(trendQuery);

      expect(trendAnalysis).toHaveProperty('historicalData');
      expect(trendAnalysis).toHaveProperty('trend');
      expect(trendAnalysis).toHaveProperty('forecast');
      expect(trendAnalysis.forecast).toHaveProperty('predicted', 145);
    });

    test('應預測志工需求', async () => {
      const demandQuery = {
        forecastPeriod: '6months',
        region: '新竹市',
        includeSeasonality: true
      };

      const mockDemandData = {
        currentVolunteers: 120,
        historicalDemand: [
          { month: 1, requiredVolunteers: 115 },
          { month: 2, requiredVolunteers: 125 },
          { month: 3, requiredVolunteers: 135 }
        ],
        seasonalFactors: {
          'summer': 1.2, // 暑假期間需求增加
          'winter': 0.9, // 冬季需求降低
          'typhoon_season': 1.5 // 颱風季需求大增
        }
      };

      mockMLService.predict.mockResolvedValue({
        monthlyForecast: [
          { month: 4, predicted: 140, confidence: 0.8 },
          { month: 5, predicted: 150, confidence: 0.75 }
        ]
      });

      mockDatabase.aggregate.mockResolvedValue([mockDemandData]);

      const demandForecast = await kpiService.forecastVolunteerDemand(demandQuery);

      expect(demandForecast).toHaveProperty('currentVolunteers', 120);
      expect(demandForecast).toHaveProperty('monthlyForecast');
      expect(demandForecast).toHaveProperty('seasonalFactors');
    });

    test('應檢測 KPI 異常模式', async () => {
      const anomalyQuery = {
        metrics: ['response_time', 'success_rate', 'volunteer_availability'],
        timeframe: 'last_week',
        sensitivity: 'medium'
      };

      const mockAnomalyData = [
        {
          metric: 'response_time',
          timestamp: new Date('2024-01-15T14:30:00Z'),
          value: 45, // 異常高的回應時間
          expectedRange: [5, 15],
          anomalyScore: 0.9,
          possibleCauses: ['系統負載過高', '志工人數不足']
        }
      ];

      mockMLService.detectAnomalies.mockResolvedValue(mockAnomalyData);

      const anomalies = await kpiService.detectKPIAnomalies(anomalyQuery);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0]).toHaveProperty('metric', 'response_time');
      expect(anomalies[0]).toHaveProperty('anomalyScore', 0.9);
      expect(anomalies[0]).toHaveProperty('possibleCauses');
    });

    test('應產生季節性趨勢報告', async () => {
      const seasonalQuery = {
        years: [2022, 2023, 2024],
        metrics: ['case_volume', 'emergency_calls'],
        includeHolidays: true
      };

      const mockSeasonalData = {
        yearlyPatterns: {
          2022: { Q1: 100, Q2: 120, Q3: 140, Q4: 110 },
          2023: { Q1: 105, Q2: 125, Q3: 145, Q4: 115 },
          2024: { Q1: 110, Q2: 130, Q3: null, Q4: null }
        },
        holidayImpact: {
          '春節': { avgIncrease: 0.3, duration: '7天' },
          '國慶連假': { avgIncrease: 0.15, duration: '4天' }
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockSeasonalData]);

      const seasonalReport = await kpiService.generateSeasonalReport(seasonalQuery);

      expect(seasonalReport).toHaveProperty('yearlyPatterns');
      expect(seasonalReport).toHaveProperty('holidayImpact');
      expect(seasonalReport).toHaveProperty('seasonalRecommendations');
    });

    test('應計算 KPI 變化率和成長率', async () => {
      const growthQuery = {
        metric: 'volunteer_efficiency',
        comparisonPeriods: ['last_month', 'same_month_last_year'],
        breakdownBy: 'region'
      };

      const mockGrowthData = {
        currentPeriod: { value: 4.5, unit: 'cases_per_hour' },
        lastMonth: { value: 4.2, unit: 'cases_per_hour' },
        sameMonthLastYear: { value: 3.8, unit: 'cases_per_hour' },
        regionalBreakdown: [
          { region: '新竹市北區', growth: 0.1, trend: 'improving' },
          { region: '新竹市東區', growth: 0.05, trend: 'stable' }
        ]
      };

      mockDatabase.aggregate.mockResolvedValue([mockGrowthData]);

      const growthAnalysis = await kpiService.calculateGrowthRates(growthQuery);

      expect(growthAnalysis).toHaveProperty('monthOverMonth');
      expect(growthAnalysis).toHaveProperty('yearOverYear');
      expect(growthAnalysis).toHaveProperty('regionalBreakdown');
      expect(growthAnalysis.monthOverMonth.growth).toBeCloseTo(0.071, 2); // (4.5-4.2)/4.2
    });
  });

  describe('警報閾值與通知 (Alert Thresholds and Notifications)', () => {
    test('應設定和管理 KPI 警報閾值', async () => {
      const thresholdConfig = {
        metric: 'emergency_response_time',
        warningThreshold: 10, // 分鐘
        criticalThreshold: 15,
        unit: 'minutes',
        notificationChannels: ['email', 'sms', 'system'],
        escalationRules: {
          'warning': ['team_lead'],
          'critical': ['team_lead', 'supervisor', 'emergency_coordinator']
        }
      };

      mockDatabase.insert.mockResolvedValue({ id: 'threshold-001' });

      const threshold = await kpiService.setThreshold(thresholdConfig);

      expect(threshold).toHaveProperty('id', 'threshold-001');
      expect(threshold).toHaveProperty('metric', 'emergency_response_time');
      expect(threshold).toHaveProperty('warningThreshold', 10);
      expect(threshold).toHaveProperty('status', 'active');
    });

    test('應檢查 KPI 值是否超過閾值', async () => {
      const currentValues = [
        { metric: 'emergency_response_time', value: 12, timestamp: new Date() },
        { metric: 'volunteer_availability', value: 0.7, timestamp: new Date() }
      ];

      const mockThresholds = [
        {
          metric: 'emergency_response_time',
          warningThreshold: 10,
          criticalThreshold: 15,
          unit: 'minutes'
        },
        {
          metric: 'volunteer_availability',
          warningThreshold: 0.8,
          criticalThreshold: 0.6,
          unit: 'ratio'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockThresholds);

      const thresholdChecks = await kpiService.checkThresholds(currentValues);

      expect(thresholdChecks).toHaveLength(2);
      expect(thresholdChecks[0]).toHaveProperty('status', 'warning'); // 12 > 10
      expect(thresholdChecks[1]).toHaveProperty('status', 'warning'); // 0.7 < 0.8
    });

    test('應發送閾值突破警報', async () => {
      const alertData = {
        metric: 'system_error_rate',
        currentValue: 0.15,
        threshold: 0.1,
        severity: 'critical',
        timestamp: new Date(),
        affectedRegions: ['新竹市北區', '新竹市東區']
      };

      mockNotificationService.sendAlert.mockResolvedValue({ sent: true, messageId: 'alert-001' });

      const alertResult = await kpiService.sendThresholdAlert(alertData);

      expect(mockNotificationService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'THRESHOLD_BREACH',
          severity: 'critical',
          metric: 'system_error_rate'
        })
      );
      expect(alertResult).toHaveProperty('sent', true);
    });

    test('應管理警報升級機制', async () => {
      const escalationConfig = {
        alertId: 'alert-001',
        currentLevel: 'warning',
        timeSinceFirstAlert: 30, // 分鐘
        escalationRules: [
          { level: 'warning', timeLimit: 15, nextLevel: 'critical' },
          { level: 'critical', timeLimit: 45, nextLevel: 'emergency' }
        ]
      };

      const escalationResult = await kpiService.processEscalation(escalationConfig);

      expect(escalationResult).toHaveProperty('shouldEscalate', true);
      expect(escalationResult).toHaveProperty('newLevel', 'critical');
      expect(escalationResult).toHaveProperty('escalationReason', 'Time limit exceeded');
    });

    test('應支援智慧型警報頻率控制', async () => {
      const alertFrequencyConfig = {
        metric: 'database_connection_failures',
        suppressionPeriod: 300, // 5分鐘內不重複發送
        adaptiveThreshold: true, // 根據歷史資料調整閾值
        timeOfDay: 'business_hours'
      };

      mockDatabase.query.mockResolvedValue([
        { timestamp: new Date(Date.now() - 200000), suppressed: false }
      ]);

      const suppressionCheck = await kpiService.checkAlertSuppression(alertFrequencyConfig);

      expect(suppressionCheck).toHaveProperty('shouldSuppress', true);
      expect(suppressionCheck).toHaveProperty('reasonCode', 'RECENT_ALERT_SENT');
      expect(suppressionCheck).toHaveProperty('nextAllowedTime');
    });

    test('應產生警報統計報告', async () => {
      const reportQuery = {
        timeframe: 'monthly',
        month: 1,
        year: 2024,
        includeResolution: true
      };

      const mockAlertStats = {
        totalAlerts: 145,
        alertsByType: {
          'threshold_breach': 89,
          'system_error': 34,
          'performance_degradation': 22
        },
        alertsBySeverity: {
          'warning': 95,
          'critical': 35,
          'emergency': 15
        },
        resolutionStats: {
          averageResolutionTime: 25, // 分鐘
          falsePositiveRate: 0.08
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockAlertStats]);

      const alertReport = await kpiService.generateAlertReport(reportQuery);

      expect(alertReport).toHaveProperty('totalAlerts', 145);
      expect(alertReport).toHaveProperty('alertsByType');
      expect(alertReport).toHaveProperty('resolutionStats');
      expect(alertReport.resolutionStats).toHaveProperty('falsePositiveRate', 0.08);
    });
  });

  describe('儀表板資料準備 (Dashboard Data Preparation)', () => {
    test('應準備即時儀表板資料', async () => {
      const dashboardQuery = {
        layout: 'executive_summary',
        refreshInterval: 30, // 秒
        widgets: ['case_overview', 'volunteer_status', 'system_health', 'alerts']
      };

      const mockDashboardData = {
        lastUpdate: new Date(),
        widgets: {
          case_overview: {
            totalActiveCases: 45,
            newCasesToday: 12,
            averageResponseTime: 8.5,
            urgentCases: 3
          },
          volunteer_status: {
            activeVolunteers: 28,
            availableVolunteers: 15,
            averageRating: 4.7,
            onBreakVolunteers: 8
          },
          system_health: {
            apiResponseTime: 120,
            errorRate: 0.02,
            uptime: 0.999,
            memoryUsage: 0.65
          },
          alerts: {
            activeAlerts: 2,
            criticalAlerts: 0,
            recentAlerts: [
              { time: '14:30', message: '志工人數不足警告', level: 'warning' }
            ]
          }
        }
      };

      mockCacheService.get.mockResolvedValue(null);
      mockDatabase.aggregate.mockResolvedValue([mockDashboardData]);
      mockCacheService.set.mockResolvedValue(true);

      const dashboardData = await kpiService.prepareDashboardData(dashboardQuery);

      expect(dashboardData).toHaveProperty('widgets');
      expect(dashboardData.widgets).toHaveProperty('case_overview');
      expect(dashboardData.widgets.case_overview).toHaveProperty('totalActiveCases', 45);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    test('應產生歷史趨勢圖表資料', async () => {
      const chartQuery = {
        chartType: 'line',
        metrics: ['daily_cases', 'daily_volunteers'],
        timeRange: 'last_30_days',
        granularity: 'daily'
      };

      const mockChartData = {
        labels: Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          return date.toISOString().split('T')[0];
        }),
        datasets: [
          {
            label: '每日案件數',
            data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 20) + 10),
            color: '#3498db'
          },
          {
            label: '每日志工數',
            data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 15) + 20),
            color: '#2ecc71'
          }
        ]
      };

      mockTimeSeriesDB.query.mockResolvedValue(mockChartData);

      const chartData = await kpiService.prepareChartData(chartQuery);

      expect(chartData).toHaveProperty('labels');
      expect(chartData).toHaveProperty('datasets');
      expect(chartData.labels).toHaveLength(30);
      expect(chartData.datasets).toHaveLength(2);
    });

    test('應產生地理分佈熱點圖資料', async () => {
      const mapQuery = {
        mapType: 'heatmap',
        metric: 'case_density',
        region: '新竹市',
        timeframe: 'current_week'
      };

      const mockMapData = {
        regions: [
          {
            name: '新竹市北區',
            coordinates: { lat: 24.8138, lng: 120.9675 },
            value: 25,
            intensity: 0.8,
            details: { totalCases: 25, avgResponseTime: 8 }
          },
          {
            name: '新竹市東區',
            coordinates: { lat: 24.8015, lng: 120.9717 },
            value: 18,
            intensity: 0.6,
            details: { totalCases: 18, avgResponseTime: 12 }
          }
        ],
        maxValue: 25,
        unit: 'cases'
      };

      mockDatabase.aggregate.mockResolvedValue([mockMapData]);

      const mapData = await kpiService.prepareMapData(mapQuery);

      expect(mapData).toHaveProperty('regions');
      expect(mapData.regions).toHaveLength(2);
      expect(mapData).toHaveProperty('maxValue', 25);
    });

    test('應產生 KPI 比較表格資料', async () => {
      const tableQuery = {
        compareBy: 'region',
        metrics: ['response_time', 'success_rate', 'volunteer_count'],
        sortBy: 'response_time',
        sortOrder: 'asc'
      };

      const mockTableData = {
        headers: ['區域', '平均回應時間', '成功率', '志工人數'],
        rows: [
          ['新竹市北區', '8.5分鐘', '92%', '28人'],
          ['新竹市東區', '12.3分鐘', '88%', '22人'],
          ['新竹市香山區', '10.1分鐘', '90%', '18人']
        ],
        totals: ['總計', '10.3分鐘', '90%', '68人']
      };

      mockDatabase.aggregate.mockResolvedValue([mockTableData]);

      const tableData = await kpiService.prepareTableData(tableQuery);

      expect(tableData).toHaveProperty('headers');
      expect(tableData).toHaveProperty('rows');
      expect(tableData.rows).toHaveLength(3);
      expect(tableData).toHaveProperty('totals');
    });

    test('應支援儀表板資料的快取機制', async () => {
      const cacheKey = 'dashboard:executive:real_time';
      const ttl = 30; // 秒

      mockCacheService.get.mockResolvedValue({
        data: { cached: true },
        timestamp: new Date()
      });

      const cachedData = await kpiService.getCachedDashboardData(cacheKey);

      expect(cachedData).toHaveProperty('cached', true);
      expect(mockCacheService.get).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('自訂 KPI 定義 (Custom KPI Definitions)', () => {
    test('應允許建立自訂 KPI 指標', async () => {
      const customKpiDef = {
        name: '志工效能指數',
        description: '綜合志工回應時間、成功率、滿意度的複合指標',
        formula: '(success_rate * 0.4) + ((1/response_time) * 0.3) + (satisfaction_score * 0.3)',
        inputMetrics: ['success_rate', 'response_time', 'satisfaction_score'],
        unit: 'index',
        targetValue: 0.8,
        category: 'volunteer_performance',
        updateFrequency: 'hourly',
        createdBy: 'admin-001'
      };

      mockDatabase.insert.mockResolvedValue({ id: 'custom-kpi-001' });

      const customKpi = await kpiService.createCustomKPI(customKpiDef);

      expect(customKpi).toHaveProperty('id', 'custom-kpi-001');
      expect(customKpi).toHaveProperty('name', '志工效能指數');
      expect(customKpi).toHaveProperty('formula');
      expect(customKpi).toHaveProperty('status', 'active');
    });

    test('應驗證自訂 KPI 公式的正確性', async () => {
      const formulaValidation = {
        formula: '(metric_a + metric_b) / metric_c',
        inputMetrics: ['metric_a', 'metric_b', 'metric_c'],
        testData: {
          metric_a: 10,
          metric_b: 20,
          metric_c: 5
        }
      };

      const validation = await kpiService.validateKPIFormula(formulaValidation);

      expect(validation).toHaveProperty('isValid', true);
      expect(validation).toHaveProperty('testResult', 6); // (10+20)/5
      expect(validation).toHaveProperty('syntaxErrors', []);
    });

    test('應計算自訂 KPI 的數值', async () => {
      const customKpiCalc = {
        kpiId: 'custom-kpi-001',
        timeframe: 'current_hour',
        inputData: {
          success_rate: 0.9,
          response_time: 8, // 分鐘
          satisfaction_score: 4.5
        }
      };

      const mockKpiDefinition = {
        formula: '(success_rate * 0.4) + ((1/response_time) * 0.3) + (satisfaction_score/5 * 0.3)',
        inputMetrics: ['success_rate', 'response_time', 'satisfaction_score']
      };

      mockDatabase.query.mockResolvedValue([mockKpiDefinition]);

      const kpiValue = await kpiService.calculateCustomKPI(customKpiCalc);

      expect(kpiValue).toHaveProperty('value');
      expect(kpiValue).toHaveProperty('timestamp');
      expect(kpiValue).toHaveProperty('inputValues');
      expect(kpiValue.value).toBeGreaterThan(0);
    });

    test('應支援條件式 KPI 計算', async () => {
      const conditionalKpi = {
        name: '緊急案件處理效率',
        conditions: {
          case_priority: 'emergency',
          time_of_day: 'business_hours'
        },
        formula: 'completed_cases / total_cases',
        fallbackValue: 0
      };

      const mockConditionalData = [
        { case_id: 'case-001', priority: 'emergency', completed: true, time: '09:30' },
        { case_id: 'case-002', priority: 'emergency', completed: false, time: '14:20' }
      ];

      mockDatabase.query.mockResolvedValue(mockConditionalData);

      const conditionalResult = await kpiService.calculateConditionalKPI(conditionalKpi);

      expect(conditionalResult).toHaveProperty('value', 0.5); // 1/2
      expect(conditionalResult).toHaveProperty('conditionsMet', true);
      expect(conditionalResult).toHaveProperty('recordCount', 2);
    });

    test('應管理 KPI 計算排程', async () => {
      const scheduleConfig = {
        kpiId: 'custom-kpi-001',
        schedule: '0 */1 * * *', // 每小時計算
        timezone: 'Asia/Taipei',
        enabled: true,
        notifyOnFailure: true
      };

      mockDatabase.insert.mockResolvedValue({ id: 'schedule-001' });

      const schedule = await kpiService.createKPISchedule(scheduleConfig);

      expect(schedule).toHaveProperty('id', 'schedule-001');
      expect(schedule).toHaveProperty('nextRunTime');
      expect(schedule).toHaveProperty('status', 'active');
    });

    test('應提供 KPI 計算歷史記錄', async () => {
      const historyQuery = {
        kpiId: 'custom-kpi-001',
        timeRange: 'last_week',
        includeInputs: true
      };

      const mockHistory = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          value: 0.85,
          inputs: { success_rate: 0.9, response_time: 7 }
        },
        {
          timestamp: new Date('2024-01-01T11:00:00Z'),
          value: 0.82,
          inputs: { success_rate: 0.88, response_time: 9 }
        }
      ];

      mockTimeSeriesDB.query.mockResolvedValue(mockHistory);

      const history = await kpiService.getKPIHistory(historyQuery);

      expect(history).toHaveProperty('data');
      expect(history.data).toHaveLength(2);
      expect(history.data[0]).toHaveProperty('inputs');
    });

    test('應支援 KPI 的版本管理', async () => {
      const versionUpdate = {
        kpiId: 'custom-kpi-001',
        newVersion: {
          formula: '(success_rate * 0.5) + ((1/response_time) * 0.3) + (satisfaction_score/5 * 0.2)',
          changeReason: '調整權重以更重視成功率',
          effectiveDate: '2024-02-01'
        }
      };

      mockDatabase.insert.mockResolvedValue({ id: 'version-002' });
      mockDatabase.update.mockResolvedValue({ modified: 1 });

      const newVersion = await kpiService.updateKPIDefinition(versionUpdate);

      expect(newVersion).toHaveProperty('version', 2);
      expect(newVersion).toHaveProperty('effectiveDate');
      expect(newVersion).toHaveProperty('changeReason');
    });

    test('應驗證 KPI 數據品質', async () => {
      const qualityCheck = {
        kpiId: 'custom-kpi-001',
        timeframe: 'last_24_hours',
        checks: ['completeness', 'accuracy', 'consistency']
      };

      const mockQualityResults = {
        completeness: {
          score: 0.95,
          missingDataPoints: 2,
          totalDataPoints: 40
        },
        accuracy: {
          score: 0.98,
          outliers: 1,
          validationErrors: 0
        },
        consistency: {
          score: 0.92,
          inconsistentValues: 3,
          trendBreaks: 1
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockQualityResults]);

      const qualityReport = await kpiService.validateKPIDataQuality(qualityCheck);

      expect(qualityReport).toHaveProperty('overallScore');
      expect(qualityReport).toHaveProperty('completeness');
      expect(qualityReport).toHaveProperty('recommendations');
    });
  });

  describe('錯誤處理 (Error Handling)', () => {
    test('應在 KPI 計算失敗時拋出計算錯誤', async () => {
      const invalidData = {
        metric: 'division_by_zero',
        numerator: 10,
        denominator: 0
      };

      await expect(kpiService.calculateRatio(invalidData))
        .rejects.toThrow(CalculationError);
    });

    test('應在閾值設定無效時拋出閾值錯誤', async () => {
      const invalidThreshold = {
        metric: 'response_time',
        warningThreshold: 20,
        criticalThreshold: 10 // critical 應該比 warning 更嚴格
      };

      await expect(kpiService.setThreshold(invalidThreshold))
        .rejects.toThrow(ThresholdError);
    });

    test('應在查詢參數無效時拋出驗證錯誤', async () => {
      const invalidQuery = {
        timeframe: 'invalid_timeframe',
        metric: null
      };

      await expect(kpiService.queryKPIData(invalidQuery))
        .rejects.toThrow(ValidationError);
    });

    test('應優雅處理資料來源連線失敗', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await kpiService.calculateKPIWithFallback('test_metric');

      expect(result).toHaveProperty('status', 'fallback');
      expect(result).toHaveProperty('value', null);
      expect(result).toHaveProperty('error', 'Connection timeout');
    });
  });
});