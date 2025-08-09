import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';
import { 
  HealthPerformanceMetrics,
  HealthHistoryEntry,
  HealthReport,
  HealthAlert,
  SystemRecommendation,
  GenerateHealthReportRequest,
  GenerateHealthReportResponse,
  GetHealthHistoryRequest,
  GetHealthHistoryResponse,
  SystemHealthCheck
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Monitoring Service - Handles performance monitoring, metrics collection, and health reporting
 * Provides comprehensive system monitoring capabilities with historical data tracking
 */
export class MonitoringService {
  private client: DynamoDBDocumentClient;
  private logger: Logger;
  private readonly metricsTable: string;
  private readonly alertsTable: string;
  private performanceBuffer: Map<string, any[]> = new Map();
  private metricsCache: Map<string, HealthPerformanceMetrics> = new Map();

  constructor() {
    this.logger = new Logger('MonitoringService');
    
    // Initialize DynamoDB client
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    
    this.metricsTable = process.env.HEALTH_METRICS_TABLE || 'StudyApp-HealthMetrics';
    this.alertsTable = process.env.HEALTH_ALERTS_TABLE || 'StudyApp-HealthAlerts';

    this.logger.info('MonitoringService initialized', {
      metricsTable: this.metricsTable,
      alertsTable: this.alertsTable
    });

    // Start background metrics collection
    this.startMetricsCollection();
  }

  /**
   * Record performance metrics for historical tracking
   */
  async recordMetrics(metrics: HealthPerformanceMetrics): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days TTL

      await this.client.send(new PutCommand({
        TableName: this.metricsTable,
        Item: {
          PK: 'METRICS',
          SK: `${timestamp}`,
          timestamp,
          metrics,
          ttl
        }
      }));

      // Update cache
      this.metricsCache.set('latest', metrics);
      
      this.logger.debug('Performance metrics recorded', { timestamp });

    } catch (error) {
      this.logger.error('Failed to record metrics', { error });
    }
  }

  /**
   * Record health history entry
   */
  async recordHealthHistory(healthCheck: SystemHealthCheck): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL

      const historyEntry: HealthHistoryEntry = {
        timestamp,
        overallStatus: healthCheck.status,
        componentStatuses: {
          dynamodb: healthCheck.dependencies.dynamodb.status,
          s3: healthCheck.dependencies.s3.status,
          overall: healthCheck.dependencies.overall
        },
        metrics: {
          responseTime: healthCheck.performance.throughput.averageResponseTime,
          errorRate: healthCheck.performance.errors.errorRate,
          throughput: healthCheck.performance.throughput.requestsPerSecond,
          memoryUsage: healthCheck.performance.memory.utilizationPercentage
        },
        alerts: healthCheck.alerts.length,
        incidents: healthCheck.alerts.filter(a => a.severity === 'critical' || a.severity === 'error').length
      };

      await this.client.send(new PutCommand({
        TableName: this.metricsTable,
        Item: {
          PK: 'HEALTH_HISTORY',
          SK: timestamp,
          ...historyEntry,
          ttl
        }
      }));

      this.logger.debug('Health history recorded', { timestamp, status: healthCheck.status });

    } catch (error) {
      this.logger.error('Failed to record health history', { error });
    }
  }

  /**
   * Store health alert
   */
  async storeAlert(alert: HealthAlert): Promise<void> {
    try {
      const ttl = Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60); // 60 days TTL

      await this.client.send(new PutCommand({
        TableName: this.alertsTable,
        Item: {
          PK: 'ALERT',
          SK: `${alert.createdAt}#${alert.alertId}`,
          ...alert,
          ttl
        }
      }));

      this.logger.info('Alert stored', { 
        alertId: alert.alertId, 
        severity: alert.severity, 
        category: alert.category 
      });

    } catch (error) {
      this.logger.error('Failed to store alert', { alertId: alert.alertId, error });
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      // First, find the alert
      const queryResult = await this.client.send(new QueryCommand({
        TableName: this.alertsTable,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'alertId = :alertId',
        ExpressionAttributeValues: {
          ':pk': 'ALERT',
          ':alertId': alertId
        }
      }));

      if (queryResult.Items && queryResult.Items.length > 0) {
        const alert = queryResult.Items[0];
        
        if (alert) {
          await this.client.send(new UpdateCommand({
          TableName: this.alertsTable,
          Key: {
            PK: alert.PK,
            SK: alert.SK
          },
          UpdateExpression: 'SET acknowledged = :ack, acknowledgedBy = :by, resolvedAt = :resolved',
          ExpressionAttributeValues: {
            ':ack': true,
            ':by': acknowledgedBy,
            ':resolved': new Date().toISOString()
          }
          }));

          this.logger.info('Alert acknowledged', { alertId, acknowledgedBy });
        }
      }

    } catch (error) {
      this.logger.error('Failed to acknowledge alert', { alertId, error });
    }
  }

  /**
   * Get health history for specified time range
   */
  async getHealthHistory(request: GetHealthHistoryRequest): Promise<GetHealthHistoryResponse> {
    try {
      const endTime = new Date().toISOString();
      const startTime = this.calculateStartTime(request.timeRange);

      const queryResult = await this.client.send(new QueryCommand({
        TableName: this.metricsTable,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': 'HEALTH_HISTORY',
          ':start': startTime,
          ':end': endTime
        },
        ScanIndexForward: true,
        Limit: 1000
      }));

      const entries: HealthHistoryEntry[] = (queryResult.Items || []).map(item => ({
        timestamp: item.timestamp,
        overallStatus: item.overallStatus,
        componentStatuses: item.componentStatuses,
        metrics: item.metrics,
        alerts: item.alerts,
        incidents: item.incidents
      }));

      // Apply resolution filtering if specified
      const filteredEntries = this.applyResolutionFilter(entries, request.resolution);

      // Calculate summary statistics
      const summary = this.calculateHistorySummary(entries);

      return {
        entries: filteredEntries,
        summary
      };

    } catch (error) {
      this.logger.error('Failed to get health history', { error });
      return {
        entries: [],
        summary: {
          totalDataPoints: 0,
          averageHealth: 0,
          incidents: 0,
          majorOutages: 0
        }
      };
    }
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(request: GenerateHealthReportRequest): Promise<GenerateHealthReportResponse> {
    try {
      this.logger.info('Generating health report', { 
        timeRange: request.timeRange,
        includeRecommendations: request.includeRecommendations 
      });

      // Get health history for the specified time range
      const historyRequest: GetHealthHistoryRequest = {
        timeRange: this.calculateTimeRangeFromDates(request.timeRange.start, request.timeRange.end),
        resolution: 'hour'
      };
      
      const historyResponse = await this.getHealthHistory(historyRequest);

      // Get alerts for the time range
      const alerts = await this.getAlertsForTimeRange(request.timeRange.start, request.timeRange.end);

      // Generate report summary
      const summary = this.generateReportSummary(historyResponse.entries, alerts);

      // Analyze trends
      const trends = this.analyzeTrends(historyResponse.entries);

      // Get top issues
      const topIssues = this.getTopIssues(alerts);

      // Generate recommendations if requested
      const recommendations = request.includeRecommendations 
        ? await this.generateRecommendations(historyResponse.entries, alerts)
        : [];

      const report: HealthReport = {
        reportId: uuidv4(),
        generatedAt: new Date().toISOString(),
        timeRange: {
          start: request.timeRange.start,
          end: request.timeRange.end,
          duration: this.calculateDuration(request.timeRange.start, request.timeRange.end)
        },
        summary,
        trends,
        topIssues,
        recommendations,
        history: historyResponse.entries
      };

      // Store report for future reference
      await this.storeReport(report);

      this.logger.info('Health report generated', { 
        reportId: report.reportId, 
        dataPoints: historyResponse.entries.length,
        alertsAnalyzed: alerts.length 
      });

      return { report };

    } catch (error) {
      this.logger.error('Failed to generate health report', { error });
      throw error;
    }
  }

  /**
   * Get current system performance trends
   */
  async getPerformanceTrends(timeRange: 'hour' | 'day' | 'week' | 'month'): Promise<any> {
    try {
      const historyRequest: GetHealthHistoryRequest = {
        timeRange,
        resolution: timeRange === 'hour' ? 'minute' : timeRange === 'day' ? 'hour' : 'day'
      };
      
      const historyResponse = await this.getHealthHistory(historyRequest);
      return this.calculateDetailedTrends(historyResponse.entries);

    } catch (error) {
      this.logger.error('Failed to get performance trends', { error });
      return null;
    }
  }

  /**
   * Get system uptime statistics
   */
  async getUptimeStats(): Promise<{ current: number; last24h: number; last7d: number; last30d: number }> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [uptime24h, uptime7d, uptime30d] = await Promise.all([
        this.calculateUptimeForPeriod(last24h, now.toISOString()),
        this.calculateUptimeForPeriod(last7d, now.toISOString()),
        this.calculateUptimeForPeriod(last30d, now.toISOString())
      ]);

      return {
        current: uptime24h, // Current is same as last 24h
        last24h: uptime24h,
        last7d: uptime7d,
        last30d: uptime30d
      };

    } catch (error) {
      this.logger.error('Failed to get uptime stats', { error });
      return { current: 0, last24h: 0, last7d: 0, last30d: 0 };
    }
  }

  /**
   * Start background metrics collection
   */
  private startMetricsCollection(): void {
    // This would typically be handled by CloudWatch or external monitoring
    // For now, we'll implement basic collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute
  }

  /**
   * Collect current system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryLimit = parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '512');
      
      const metrics: HealthPerformanceMetrics = {
        memory: {
          current: Math.round(memoryUsage.rss / 1024 / 1024),
          peak: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          limit: memoryLimit,
          utilizationPercentage: Math.round((memoryUsage.rss / 1024 / 1024) / memoryLimit * 100),
          gcFrequency: 0
        },
        execution: {
          coldStartFrequency: 0,
          averageExecutionTime: 0,
          p95ExecutionTime: 0,
          p99ExecutionTime: 0,
          timeouts: 0
        },
        throughput: {
          requestsPerSecond: 0,
          requestsPerMinute: 0,
          requestsPerHour: 0,
          peakThroughput: 0,
          averageResponseTime: 0
        },
        errors: {
          errorRate: 0,
          errorCount: 0,
          errorsByType: {},
          criticalErrors: 0,
          warnings: 0
        },
        trends: {
          responseTimeTrend: 'stable',
          errorRateTrend: 'stable',
          throughputTrend: 'stable',
          memoryUsageTrend: 'stable'
        }
      };

      // Store metrics but don't wait for it
      this.recordMetrics(metrics).catch(error => {
        this.logger.warn('Background metrics recording failed', { error });
      });

    } catch (error) {
      this.logger.warn('Background metrics collection failed', { error });
    }
  }

  // Helper methods
  private calculateStartTime(timeRange: 'hour' | 'day' | 'week' | 'month'): string {
    const now = new Date();
    let hours = 1;
    
    switch (timeRange) {
      case 'hour': hours = 1; break;
      case 'day': hours = 24; break;
      case 'week': hours = 24 * 7; break;
      case 'month': hours = 24 * 30; break;
    }
    
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  }

  private calculateTimeRangeFromDates(start: string, end: string): 'hour' | 'day' | 'week' | 'month' {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours <= 1) return 'hour';
    if (diffHours <= 24) return 'day';
    if (diffHours <= 168) return 'week';
    return 'month';
  }

  private calculateDuration(start: string, end: string): string {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d`;
  }

  private applyResolutionFilter(entries: HealthHistoryEntry[], resolution?: 'minute' | 'hour' | 'day'): HealthHistoryEntry[] {
    if (!resolution || entries.length <= 100) return entries;
    
    // Simple sampling for now - in production, you'd implement proper aggregation
    const sampleRate = resolution === 'minute' ? 1 : resolution === 'hour' ? 60 : 1440;
    return entries.filter((_, index) => index % sampleRate === 0);
  }

  private calculateHistorySummary(entries: HealthHistoryEntry[]): any {
    const totalDataPoints = entries.length;
    const healthyCount = entries.filter(e => e.overallStatus === 'healthy').length;
    const averageHealth = totalDataPoints > 0 ? (healthyCount / totalDataPoints) * 100 : 0;
    const incidents = entries.reduce((sum, e) => sum + e.incidents, 0);
    const majorOutages = entries.filter(e => e.overallStatus === 'unhealthy').length;

    return {
      totalDataPoints,
      averageHealth,
      incidents,
      majorOutages
    };
  }

  private async getAlertsForTimeRange(start: string, end: string): Promise<HealthAlert[]> {
    try {
      const queryResult = await this.client.send(new QueryCommand({
        TableName: this.alertsTable,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': 'ALERT',
          ':start': start,
          ':end': end
        }
      }));

      return (queryResult.Items || []) as HealthAlert[];
    } catch (error) {
      this.logger.error('Failed to get alerts for time range', { error });
      return [];
    }
  }

  private generateReportSummary(entries: HealthHistoryEntry[], alerts: HealthAlert[]): any {
    const totalEntries = entries.length;
    const healthyEntries = entries.filter(e => e.overallStatus === 'healthy').length;
    const uptimePercentage = totalEntries > 0 ? (healthyEntries / totalEntries) * 100 : 100;
    
    const totalIncidents = alerts.length;
    const resolvedIncidents = alerts.filter(a => a.resolvedAt).length;
    
    const responseTimes = entries.map(e => e.metrics.responseTime).filter(rt => rt > 0);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0;
    
    const errorRates = entries.map(e => e.metrics.errorRate).filter(er => er > 0);
    const errorRate = errorRates.length > 0 
      ? errorRates.reduce((sum, er) => sum + er, 0) / errorRates.length 
      : 0;

    const overallHealth = uptimePercentage >= 99.9 ? 'excellent' 
      : uptimePercentage >= 99.5 ? 'good'
      : uptimePercentage >= 95 ? 'fair' 
      : 'poor';

    return {
      overallHealth,
      uptimePercentage,
      totalIncidents,
      resolvedIncidents,
      averageResponseTime,
      errorRate
    };
  }

  private analyzeTrends(entries: HealthHistoryEntry[]): any {
    if (entries.length < 2) {
      return {
        availabilityTrend: 'stable',
        performanceTrend: 'stable',
        errorTrend: 'stable',
        dataQualityTrend: 'stable'
      };
    }

    const midpoint = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, midpoint);
    const secondHalf = entries.slice(midpoint);

    const firstAvailability = firstHalf.filter(e => e.overallStatus === 'healthy').length / firstHalf.length;
    const secondAvailability = secondHalf.filter(e => e.overallStatus === 'healthy').length / secondHalf.length;
    
    const firstPerformance = firstHalf.reduce((sum, e) => sum + e.metrics.responseTime, 0) / firstHalf.length;
    const secondPerformance = secondHalf.reduce((sum, e) => sum + e.metrics.responseTime, 0) / secondHalf.length;
    
    const firstErrorRate = firstHalf.reduce((sum, e) => sum + e.metrics.errorRate, 0) / firstHalf.length;
    const secondErrorRate = secondHalf.reduce((sum, e) => sum + e.metrics.errorRate, 0) / secondHalf.length;

    return {
      availabilityTrend: secondAvailability > firstAvailability ? 'improving' : 
                        secondAvailability < firstAvailability ? 'degrading' : 'stable',
      performanceTrend: secondPerformance < firstPerformance ? 'improving' :
                       secondPerformance > firstPerformance ? 'degrading' : 'stable',
      errorTrend: secondErrorRate < firstErrorRate ? 'improving' :
                 secondErrorRate > firstErrorRate ? 'degrading' : 'stable',
      dataQualityTrend: 'stable' // Would need data quality metrics
    };
  }

  private getTopIssues(alerts: HealthAlert[]): HealthAlert[] {
    return alerts
      .filter(a => a.severity === 'critical' || a.severity === 'error')
      .sort((a, b) => {
        const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 10);
  }

  private async generateRecommendations(entries: HealthHistoryEntry[], alerts: HealthAlert[]): Promise<SystemRecommendation[]> {
    const recommendations: SystemRecommendation[] = [];

    // Analyze patterns and generate recommendations
    const avgResponseTime = entries.reduce((sum, e) => sum + e.metrics.responseTime, 0) / entries.length;
    const avgErrorRate = entries.reduce((sum, e) => sum + e.metrics.errorRate, 0) / entries.length;
    const avgMemoryUsage = entries.reduce((sum, e) => sum + e.metrics.memoryUsage, 0) / entries.length;

    if (avgResponseTime > 1000) {
      recommendations.push({
        id: uuidv4(),
        priority: 'high',
        category: 'performance',
        title: 'Optimize Response Time',
        description: 'Average response time is above optimal threshold',
        reasoning: `Current average response time of ${Math.round(avgResponseTime)}ms exceeds the 1000ms threshold`,
        actionItems: [
          'Implement database query optimization',
          'Add caching layer for frequently accessed data',
          'Review Lambda memory allocation',
          'Optimize code execution paths'
        ],
        estimatedImpact: {
          performance: 30,
          cost: 0,
          reliability: 10
        },
        effort: 'medium',
        timeline: '2-4 weeks'
      });
    }

    if (avgErrorRate > 1) {
      recommendations.push({
        id: uuidv4(),
        priority: 'high',
        category: 'reliability',
        title: 'Reduce Error Rate',
        description: 'Error rate is higher than acceptable levels',
        reasoning: `Current error rate of ${avgErrorRate.toFixed(2)}% exceeds the 1% threshold`,
        actionItems: [
          'Review and improve error handling',
          'Implement retry mechanisms',
          'Add input validation',
          'Monitor third-party dependencies'
        ],
        estimatedImpact: {
          performance: 10,
          cost: 0,
          reliability: 40
        },
        effort: 'medium',
        timeline: '1-2 weeks'
      });
    }

    if (avgMemoryUsage > 80) {
      recommendations.push({
        id: uuidv4(),
        priority: 'medium',
        category: 'performance',
        title: 'Optimize Memory Usage',
        description: 'Memory utilization is approaching limits',
        reasoning: `Current average memory usage of ${Math.round(avgMemoryUsage)}% is above the 80% threshold`,
        actionItems: [
          'Increase Lambda memory allocation',
          'Optimize data structures and algorithms',
          'Implement memory cleanup routines',
          'Profile memory usage patterns'
        ],
        estimatedImpact: {
          performance: 20,
          cost: -100, // Negative indicates cost increase
          reliability: 15
        },
        effort: 'low',
        timeline: '1 week'
      });
    }

    return recommendations;
  }

  private calculateDetailedTrends(entries: HealthHistoryEntry[]): any {
    // Implementation for detailed trend analysis
    return {
      responseTime: entries.map(e => ({ timestamp: e.timestamp, value: e.metrics.responseTime })),
      errorRate: entries.map(e => ({ timestamp: e.timestamp, value: e.metrics.errorRate })),
      throughput: entries.map(e => ({ timestamp: e.timestamp, value: e.metrics.throughput })),
      memoryUsage: entries.map(e => ({ timestamp: e.timestamp, value: e.metrics.memoryUsage }))
    };
  }

  private async calculateUptimeForPeriod(start: string, end: string): Promise<number> {
    try {
      const queryResult = await this.client.send(new QueryCommand({
        TableName: this.metricsTable,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': 'HEALTH_HISTORY',
          ':start': start,
          ':end': end
        }
      }));

      const entries = queryResult.Items || [];
      if (entries.length === 0) return 100; // Default to 100% if no data

      const healthyEntries = entries.filter(item => item.overallStatus === 'healthy').length;
      return (healthyEntries / entries.length) * 100;

    } catch (error) {
      this.logger.error('Failed to calculate uptime', { error });
      return 100; // Default to 100% on error
    }
  }

  private async storeReport(report: HealthReport): Promise<void> {
    try {
      const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year TTL

      await this.client.send(new PutCommand({
        TableName: this.metricsTable,
        Item: {
          PK: 'REPORT',
          SK: `${report.generatedAt}#${report.reportId}`,
          ...report,
          ttl
        }
      }));

    } catch (error) {
      this.logger.warn('Failed to store report', { reportId: report.reportId, error });
    }
  }
}