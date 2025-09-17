/**
 * KPIService - P4 RBAC Console
 *
 * Manages aggregated metrics with no PII in reports including
 * coverage, response time, and false positive rates for system monitoring.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class KPIService {
  constructor(dependencies) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.auditService = dependencies.auditService;
    this.rbacService = dependencies.rbacService;

    this.metricTypes = {
      coverage: 'Coverage',
      response_time: 'Response Time',
      false_positive_rate: 'False Positive Rate',
      volunteer_participation: 'Volunteer Participation',
      case_resolution: 'Case Resolution',
      system_performance: 'System Performance'
    };

    this.aggregationPeriods = {
      hourly: 'Hourly',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly'
    };
  }

  async recordMetric(metricData) {
    // Ensure no PII is included in metrics
    const sanitizedMetric = this.sanitizeMetricData(metricData);

    const metric = {
      id: require('crypto').randomUUID(),
      timestamp: new Date().toISOString(),
      type: sanitizedMetric.type,
      category: sanitizedMetric.category,
      value: sanitizedMetric.value,
      unit: sanitizedMetric.unit,
      metadata: sanitizedMetric.metadata || {},
      aggregationLevel: sanitizedMetric.aggregationLevel || 'daily'
    };

    await this.storage.setItem(`metric_${metric.id}`, metric);

    // Store in time-series format
    await this.addToTimeSeries(metric);

    return metric;
  }

  sanitizeMetricData(data) {
    // Remove any potential PII from metric data
    const sanitized = { ...data };

    // Remove PII fields
    delete sanitized.userId;
    delete sanitized.personalInfo;
    delete sanitized.contactDetails;
    delete sanitized.deviceId;
    delete sanitized.macAddress;

    // Ensure location data is aggregated only
    if (sanitized.location) {
      sanitized.location = {
        area: sanitized.location.area || 'aggregated',
        gridSquare: sanitized.location.gridSquare
      };
      delete sanitized.location.coordinates;
      delete sanitized.location.address;
    }

    return sanitized;
  }

  async addToTimeSeries(metric) {
    const timeKey = this.getTimeSeriesKey(metric.timestamp, metric.aggregationLevel);
    const seriesKey = `timeseries_${metric.type}_${timeKey}`;

    const existingSeries = await this.storage.getItem(seriesKey) || [];
    existingSeries.push({
      timestamp: metric.timestamp,
      value: metric.value,
      metadata: metric.metadata
    });

    await this.storage.setItem(seriesKey, existingSeries);
  }

  getTimeSeriesKey(timestamp, aggregationLevel) {
    const date = new Date(timestamp);

    switch (aggregationLevel) {
      case 'hourly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
      case 'daily':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      case 'weekly':
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        return `${weekStart.getFullYear()}-W${String(Math.ceil(weekStart.getDate() / 7)).padStart(2, '0')}`;
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
  }

  // Coverage Metrics
  async recordCoverageMetric(data) {
    return await this.recordMetric({
      type: 'coverage',
      category: 'geo_coverage',
      value: data.coveragePercentage,
      unit: 'percentage',
      metadata: {
        area: data.area,
        totalArea: data.totalArea,
        coveredArea: data.coveredArea,
        volunteerCount: data.volunteerCount
      }
    });
  }

  async getCoverageKPIs(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const metrics = await this.getMetricsByType('coverage', timeRange);

    return {
      current: this.calculateAverageValue(metrics),
      trend: this.calculateTrend(metrics),
      byArea: this.aggregateByArea(metrics),
      volunteerContribution: this.calculateVolunteerContribution(metrics)
    };
  }

  // Response Time Metrics
  async recordResponseTime(data) {
    return await this.recordMetric({
      type: 'response_time',
      category: 'case_response',
      value: data.responseTimeMinutes,
      unit: 'minutes',
      metadata: {
        caseType: data.caseType,
        priority: data.priority,
        area: data.area
      }
    });
  }

  async getResponseTimeKPIs(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const metrics = await this.getMetricsByType('response_time', timeRange);

    return {
      averageResponseTime: this.calculateAverageValue(metrics),
      medianResponseTime: this.calculateMedianValue(metrics),
      responseTimeByPriority: this.aggregateByPriority(metrics),
      trend: this.calculateTrend(metrics),
      slaCompliance: this.calculateSLACompliance(metrics)
    };
  }

  // False Positive Rate Metrics
  async recordFalsePositive(data) {
    return await this.recordMetric({
      type: 'false_positive_rate',
      category: 'alert_accuracy',
      value: 1, // Count of false positive
      unit: 'count',
      metadata: {
        alertType: data.alertType,
        area: data.area,
        detectionMethod: data.detectionMethod
      }
    });
  }

  async recordTruePositive(data) {
    return await this.recordMetric({
      type: 'true_positive_rate',
      category: 'alert_accuracy',
      value: 1, // Count of true positive
      unit: 'count',
      metadata: {
        alertType: data.alertType,
        area: data.area,
        detectionMethod: data.detectionMethod
      }
    });
  }

  async getFalsePositiveKPIs(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const falsePositives = await this.getMetricsByType('false_positive_rate', timeRange);
    const truePositives = await this.getMetricsByType('true_positive_rate', timeRange);

    const totalFalsePositives = this.sumValues(falsePositives);
    const totalTruePositives = this.sumValues(truePositives);
    const totalAlerts = totalFalsePositives + totalTruePositives;

    return {
      falsePositiveRate: totalAlerts > 0 ? (totalFalsePositives / totalAlerts) * 100 : 0,
      accuracy: totalAlerts > 0 ? (totalTruePositives / totalAlerts) * 100 : 0,
      totalAlerts,
      trend: this.calculateAccuracyTrend(falsePositives, truePositives),
      byDetectionMethod: this.aggregateByDetectionMethod(falsePositives, truePositives)
    };
  }

  // Volunteer Participation Metrics
  async recordVolunteerActivity(data) {
    return await this.recordMetric({
      type: 'volunteer_participation',
      category: 'engagement',
      value: data.activeVolunteers,
      unit: 'count',
      metadata: {
        area: data.area,
        timeSlot: data.timeSlot,
        activityType: data.activityType
      }
    });
  }

  async getVolunteerKPIs(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const metrics = await this.getMetricsByType('volunteer_participation', timeRange);

    return {
      activeVolunteers: this.calculateAverageValue(metrics),
      peakHours: this.identifyPeakHours(metrics),
      participationByArea: this.aggregateByArea(metrics),
      retentionRate: this.calculateRetentionRate(metrics),
      trend: this.calculateTrend(metrics)
    };
  }

  // Case Resolution Metrics
  async recordCaseResolution(data) {
    return await this.recordMetric({
      type: 'case_resolution',
      category: 'effectiveness',
      value: data.resolutionTimeHours,
      unit: 'hours',
      metadata: {
        caseType: data.caseType,
        priority: data.priority,
        outcome: data.outcome,
        area: data.area
      }
    });
  }

  async getCaseResolutionKPIs(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const metrics = await this.getMetricsByType('case_resolution', timeRange);

    return {
      averageResolutionTime: this.calculateAverageValue(metrics),
      resolutionRate: this.calculateResolutionRate(metrics),
      resolutionByPriority: this.aggregateByPriority(metrics),
      outcomeDistribution: this.aggregateByOutcome(metrics),
      trend: this.calculateTrend(metrics)
    };
  }

  // System Performance Metrics
  async recordSystemPerformance(data) {
    return await this.recordMetric({
      type: 'system_performance',
      category: 'technical',
      value: data.value,
      unit: data.unit,
      metadata: {
        component: data.component,
        metricName: data.metricName
      }
    });
  }

  async getSystemPerformanceKPIs(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const metrics = await this.getMetricsByType('system_performance', timeRange);

    return {
      uptime: this.calculateUptime(metrics),
      responseLatency: this.calculateResponseLatency(metrics),
      throughput: this.calculateThroughput(metrics),
      errorRate: this.calculateErrorRate(metrics),
      trend: this.calculateTrend(metrics)
    };
  }

  // Comprehensive Dashboard
  async getDashboard(timeRange, userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    const [
      coverage,
      responseTime,
      falsePositives,
      volunteers,
      caseResolution,
      systemPerformance
    ] = await Promise.all([
      this.getCoverageKPIs(timeRange, userId),
      this.getResponseTimeKPIs(timeRange, userId),
      this.getFalsePositiveKPIs(timeRange, userId),
      this.getVolunteerKPIs(timeRange, userId),
      this.getCaseResolutionKPIs(timeRange, userId),
      this.getSystemPerformanceKPIs(timeRange, userId)
    ]);

    await this.auditService?.logDataAccess({
      userId,
      dataType: 'kpi_dashboard',
      timestamp: new Date().toISOString()
    });

    return {
      coverage,
      responseTime,
      falsePositives,
      volunteers,
      caseResolution,
      systemPerformance,
      generatedAt: new Date().toISOString()
    };
  }

  // Helper calculation methods
  async getMetricsByType(type, timeRange) {
    // Mock implementation - in real scenario would query database
    if (this.database) {
      const query = `
        SELECT * FROM metrics
        WHERE type = $1 AND timestamp >= $2 AND timestamp <= $3
        ORDER BY timestamp DESC
      `;

      const result = await this.database.query(query, [
        type,
        timeRange.start,
        timeRange.end
      ]);

      return result.rows || [];
    }

    return [];
  }

  calculateAverageValue(metrics) {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return Math.round((sum / metrics.length) * 100) / 100;
  }

  calculateMedianValue(metrics) {
    if (metrics.length === 0) return 0;
    const sorted = metrics.map(m => m.value).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  sumValues(metrics) {
    return metrics.reduce((acc, metric) => acc + metric.value, 0);
  }

  calculateTrend(metrics) {
    if (metrics.length < 2) return 0;

    const recent = metrics.slice(0, Math.floor(metrics.length / 2));
    const older = metrics.slice(Math.floor(metrics.length / 2));

    const recentAvg = this.calculateAverageValue(recent);
    const olderAvg = this.calculateAverageValue(older);

    if (olderAvg === 0) return 0;
    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  aggregateByArea(metrics) {
    const areaMap = {};
    metrics.forEach(metric => {
      const area = metric.metadata?.area || 'unknown';
      if (!areaMap[area]) {
        areaMap[area] = [];
      }
      areaMap[area].push(metric.value);
    });

    const result = {};
    Object.keys(areaMap).forEach(area => {
      result[area] = this.calculateAverageValue(
        areaMap[area].map(value => ({ value }))
      );
    });

    return result;
  }

  aggregateByPriority(metrics) {
    const priorityMap = {};
    metrics.forEach(metric => {
      const priority = metric.metadata?.priority || 'medium';
      if (!priorityMap[priority]) {
        priorityMap[priority] = [];
      }
      priorityMap[priority].push(metric.value);
    });

    const result = {};
    Object.keys(priorityMap).forEach(priority => {
      result[priority] = this.calculateAverageValue(
        priorityMap[priority].map(value => ({ value }))
      );
    });

    return result;
  }

  calculateSLACompliance(metrics) {
    // SLA: Response time < 30 minutes
    const slaThreshold = 30;
    const compliantCount = metrics.filter(m => m.value <= slaThreshold).length;
    return metrics.length > 0 ? (compliantCount / metrics.length) * 100 : 0;
  }

  calculateResolutionRate(metrics) {
    const resolvedCount = metrics.filter(
      m => m.metadata?.outcome === 'resolved'
    ).length;
    return metrics.length > 0 ? (resolvedCount / metrics.length) * 100 : 0;
  }

  async exportKPIs(timeRange, format, userId) {
    await this.rbacService?.checkPermission(userId, 'export_data');

    const dashboard = await this.getDashboard(timeRange, userId);
    const exportId = require('crypto').randomUUID();

    await this.auditService?.logDataExport({
      userId,
      dataType: 'kpi_metrics',
      format,
      recordCount: Object.keys(dashboard).length,
      fileName: `kpi_export_${new Date().toISOString()}.${format}`,
      exportId
    });

    return {
      exportId,
      data: dashboard,
      format,
      timestamp: new Date().toISOString()
    };
  }

  // Mock implementations for complex calculations
  calculateVolunteerContribution(metrics) { return { total: 0, byArea: {} }; }
  calculateAccuracyTrend(fp, tp) { return 0; }
  aggregateByDetectionMethod(fp, tp) { return {}; }
  identifyPeakHours(metrics) { return []; }
  calculateRetentionRate(metrics) { return 0; }
  aggregateByOutcome(metrics) { return {}; }
  calculateUptime(metrics) { return 99.9; }
  calculateResponseLatency(metrics) { return 0; }
  calculateThroughput(metrics) { return 0; }
  calculateErrorRate(metrics) { return 0; }
}

module.exports = KPIService;