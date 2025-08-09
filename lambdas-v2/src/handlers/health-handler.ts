import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { HealthService } from '../services/health-service';
import { MonitoringService } from '../services/monitoring-service';
import { 
  GetHealthRequest,
  GetHealthResponse,
  GetHealthPerformanceMetricsRequest,
  GetHealthPerformanceMetricsResponse,
  GetAlertsRequest,
  GetAlertsResponse,
  GetHealthHistoryRequest,
  GetHealthHistoryResponse,
  GenerateHealthReportRequest,
  GenerateHealthReportResponse
} from '../types';

/**
 * Health Handler V2 - Comprehensive System Health & Monitoring
 * 
 * Provides multiple endpoints for system health monitoring:
 * - GET /health - Basic health check
 * - GET /health/detailed - Comprehensive system health with dependencies
 * - GET /health/performance - Performance metrics and trends
 * - GET /health/database - Database connectivity and performance
 * - GET /health/storage - S3 and storage system health
 * - GET /health/services - All service health overview
 * - GET /health/alerts - Current alerts and recommendations
 * - GET /health/history - Health history and trends
 */
class HealthHandler extends BaseHandler {
  private healthService: HealthService;
  private monitoringService: MonitoringService;

  constructor() {
    super('HealthHandler');
    this.healthService = new HealthService();
    this.monitoringService = new MonitoringService();
  }

  /**
   * Basic health check endpoint - returns simple status
   * GET /health
   */
  public async checkHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Basic health check requested');

    try {
      const healthCheck = await this.healthService.performHealthCheck();
      
      // Record the health check for historical tracking
      await this.monitoringService.recordHealthHistory(healthCheck);

      // Return simplified response for basic health check
      const basicHealth = {
        status: healthCheck.status,
        version: this.version,
        stage: healthCheck.environment.stage,
        timestamp: healthCheck.timestamp,
        uptime: healthCheck.environment.uptime,
        dependencies: {
          overall: healthCheck.dependencies.overall,
          dynamodb: healthCheck.dependencies.dynamodb.status,
          s3: healthCheck.dependencies.s3.status
        },
        alerts: healthCheck.alerts.length,
        recommendations: healthCheck.recommendations.length
      };

      return this.success(basicHealth, 'Health check completed successfully');
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return this.internalError('Health check failed');
    }
  }

  /**
   * Detailed health check endpoint - returns comprehensive system health
   * GET /health/detailed
   */
  public async getDetailedHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Detailed health check requested');

    try {
      const includeHistory = event.queryStringParameters?.includeHistory === 'true';
      
      const healthCheck = await this.healthService.performHealthCheck();
      
      // Record the health check
      await this.monitoringService.recordHealthHistory(healthCheck);
      
      // Get uptime statistics
      const uptime = await this.monitoringService.getUptimeStats();
      
      let history = undefined;
      if (includeHistory) {
        const historyRequest: GetHealthHistoryRequest = {
          timeRange: 'day',
          resolution: 'hour'
        };
        const historyResponse = await this.monitoringService.getHealthHistory(historyRequest);
        history = historyResponse.entries.slice(-24); // Last 24 hours
      }

      const response: GetHealthResponse = {
        health: healthCheck,
        history,
        uptime
      };

      return this.success(response, 'Detailed health check completed successfully');
    } catch (error) {
      this.logger.error('Detailed health check failed', { error });
      return this.internalError('Detailed health check failed');
    }
  }

  /**
   * Performance metrics endpoint - returns performance data and trends
   * GET /health/performance
   */
  public async getPerformanceMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Performance metrics requested');

    try {
      const timeRange = (event.queryStringParameters?.timeRange as 'hour' | 'day' | 'week' | 'month') || 'day';
      const includeHistorical = event.queryStringParameters?.includeHistorical === 'true';

      // Get current performance metrics from health check
      const healthCheck = await this.healthService.performHealthCheck();
      const currentMetrics = healthCheck.performance;

      // Record current metrics
      await this.monitoringService.recordMetrics(currentMetrics);

      let historical = undefined;
      if (includeHistorical) {
        historical = await this.monitoringService.getPerformanceTrends(timeRange);
      }

      const response: GetHealthPerformanceMetricsResponse = {
        current: currentMetrics,
        historical,
        trends: currentMetrics.trends
      };

      return this.success(response, 'Performance metrics retrieved successfully');
    } catch (error) {
      this.logger.error('Performance metrics retrieval failed', { error });
      return this.internalError('Performance metrics retrieval failed');
    }
  }

  /**
   * Database health endpoint - returns database connectivity and performance
   * GET /health/database
   */
  public async getDatabaseHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Database health check requested');

    try {
      const healthCheck = await this.healthService.performHealthCheck();
      const databaseHealth = healthCheck.dependencies.dynamodb;

      // Additional database-specific metrics
      const databaseMetrics = {
        ...databaseHealth,
        timestamp: healthCheck.timestamp,
        environment: {
          region: healthCheck.environment.region,
          stage: healthCheck.environment.stage
        },
        dataQuality: healthCheck.dataQuality.checks.filter(check => 
          check.table.includes('Users') || 
          check.table.includes('Sessions') || 
          check.table.includes('Goals') || 
          check.table.includes('Analytics')
        )
      };

      return this.success(databaseMetrics, 'Database health check completed successfully');
    } catch (error) {
      this.logger.error('Database health check failed', { error });
      return this.internalError('Database health check failed');
    }
  }

  /**
   * Storage health endpoint - returns S3 and storage system health
   * GET /health/storage
   */
  public async getStorageHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Storage health check requested');

    try {
      const healthCheck = await this.healthService.performHealthCheck();
      const storageHealth = healthCheck.dependencies.s3;

      const storageMetrics = {
        ...storageHealth,
        timestamp: healthCheck.timestamp,
        environment: {
          region: healthCheck.environment.region,
          stage: healthCheck.environment.stage
        },
        alerts: healthCheck.alerts.filter(alert => 
          alert.category === 'availability' || 
          alert.source.toLowerCase().includes('s3')
        )
      };

      return this.success(storageMetrics, 'Storage health check completed successfully');
    } catch (error) {
      this.logger.error('Storage health check failed', { error });
      return this.internalError('Storage health check failed');
    }
  }

  /**
   * Services overview endpoint - returns all service health overview
   * GET /health/services
   */
  public async getServicesOverview(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Services overview requested');

    try {
      const healthCheck = await this.healthService.performHealthCheck();

      const servicesOverview = {
        timestamp: healthCheck.timestamp,
        overallStatus: healthCheck.status,
        services: {
          database: {
            service: 'DynamoDB',
            status: healthCheck.dependencies.dynamodb.status,
            responseTime: healthCheck.dependencies.dynamodb.connectivity.responseTime,
            tables: healthCheck.dependencies.dynamodb.tables.length,
            errors: healthCheck.dependencies.dynamodb.tables.reduce((sum, table) => sum + table.errors.length, 0)
          },
          storage: {
            service: 'S3',
            status: healthCheck.dependencies.s3.status,
            responseTime: healthCheck.dependencies.s3.connectivity.responseTime,
            buckets: healthCheck.dependencies.s3.buckets.length,
            errors: healthCheck.dependencies.s3.buckets.reduce((sum, bucket) => sum + bucket.errors.length, 0)
          },
          external: healthCheck.dependencies.external.map(ext => ({
            service: ext.serviceName,
            status: ext.status,
            responseTime: ext.responseTime,
            uptime: ext.uptime,
            errors: ext.errors.length
          }))
        },
        performance: {
          averageResponseTime: healthCheck.performance.throughput.averageResponseTime,
          errorRate: healthCheck.performance.errors.errorRate,
          memoryUsage: healthCheck.performance.memory.utilizationPercentage,
          throughput: healthCheck.performance.throughput.requestsPerSecond
        },
        summary: {
          totalServices: 2 + healthCheck.dependencies.external.length,
          healthyServices: [
            healthCheck.dependencies.dynamodb.status === 'healthy' ? 1 : 0,
            healthCheck.dependencies.s3.status === 'healthy' ? 1 : 0,
            ...healthCheck.dependencies.external.map(ext => ext.status === 'healthy' ? 1 : 0)
          ].reduce((sum, count) => sum + count, 0),
          alerts: healthCheck.alerts.length,
          recommendations: healthCheck.recommendations.length
        }
      };

      return this.success(servicesOverview, 'Services overview retrieved successfully');
    } catch (error) {
      this.logger.error('Services overview retrieval failed', { error });
      return this.internalError('Services overview retrieval failed');
    }
  }

  /**
   * Alerts endpoint - returns current alerts and recommendations
   * GET /health/alerts
   */
  public async getAlerts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Alerts requested');

    try {
      const severity = event.queryStringParameters?.severity as 'info' | 'warning' | 'error' | 'critical';
      const category = event.queryStringParameters?.category as 'performance' | 'availability' | 'data_quality' | 'security' | 'capacity';
      const limit = parseInt(event.queryStringParameters?.limit || '50');

      const healthCheck = await this.healthService.performHealthCheck();
      let alerts = healthCheck.alerts;

      // Apply filters
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }
      if (category) {
        alerts = alerts.filter(alert => alert.category === category);
      }
      
      // Apply limit
      alerts = alerts.slice(0, limit);

      // Calculate summary statistics
      const allAlerts = healthCheck.alerts;
      const summary = {
        total: allAlerts.length,
        active: allAlerts.filter(a => !a.resolvedAt).length,
        resolved: allAlerts.filter(a => a.resolvedAt).length,
        acknowledged: allAlerts.filter(a => a.acknowledged).length,
        bySeverity: {
          critical: allAlerts.filter(a => a.severity === 'critical').length,
          error: allAlerts.filter(a => a.severity === 'error').length,
          warning: allAlerts.filter(a => a.severity === 'warning').length,
          info: allAlerts.filter(a => a.severity === 'info').length
        },
        byCategory: {
          performance: allAlerts.filter(a => a.category === 'performance').length,
          availability: allAlerts.filter(a => a.category === 'availability').length,
          data_quality: allAlerts.filter(a => a.category === 'data_quality').length,
          security: allAlerts.filter(a => a.category === 'security').length,
          capacity: allAlerts.filter(a => a.category === 'capacity').length
        }
      };

      const response: GetAlertsResponse = {
        alerts,
        summary
      };

      return this.success(response, 'Alerts retrieved successfully');
    } catch (error) {
      this.logger.error('Alerts retrieval failed', { error });
      return this.internalError('Alerts retrieval failed');
    }
  }

  /**
   * Health history endpoint - returns historical health data and trends
   * GET /health/history
   */
  public async getHealthHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Health history requested');

    try {
      const timeRange = (event.queryStringParameters?.timeRange as 'hour' | 'day' | 'week' | 'month') || 'day';
      const resolution = event.queryStringParameters?.resolution as 'minute' | 'hour' | 'day';
      const components = event.queryStringParameters?.components?.split(',');

      const request: GetHealthHistoryRequest = {
        timeRange,
        resolution,
        components
      };

      const response = await this.monitoringService.getHealthHistory(request);

      return this.success(response, 'Health history retrieved successfully');
    } catch (error) {
      this.logger.error('Health history retrieval failed', { error });
      return this.internalError('Health history retrieval failed');
    }
  }

  /**
   * Health report endpoint - generates comprehensive health reports
   * POST /health/report
   */
  public async generateHealthReport(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Health report generation requested');

    try {
      const body = JSON.parse(event.body || '{}') as GenerateHealthReportRequest;
      
      // Validate request
      if (!body.timeRange?.start || !body.timeRange?.end) {
        return this.badRequest('Time range is required');
      }

      const response = await this.monitoringService.generateHealthReport(body);

      return this.success(response, 'Health report generated successfully');
    } catch (error) {
      this.logger.error('Health report generation failed', { error });
      return this.internalError('Health report generation failed');
    }
  }

  /**
   * Acknowledge alert endpoint - acknowledge a specific alert
   * PUT /health/alerts/{alertId}/acknowledge
   */
  public async acknowledgeAlert(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Alert acknowledgment requested');

    try {
      const alertId = event.pathParameters?.alertId;
      const body = JSON.parse(event.body || '{}');
      const acknowledgedBy = body.acknowledgedBy || 'system';

      if (!alertId) {
        return this.badRequest('Alert ID is required');
      }

      await this.monitoringService.acknowledgeAlert(alertId, acknowledgedBy);

      return this.success({ alertId, acknowledgedBy, acknowledgedAt: new Date().toISOString() }, 'Alert acknowledged successfully');
    } catch (error) {
      this.logger.error('Alert acknowledgment failed', { error });
      return this.internalError('Alert acknowledgment failed');
    }
  }
}

// Route handler for different endpoints
const healthHandler = new HealthHandler();

// Export different endpoints
export const handler = healthHandler.withoutAuth(async (event: APIGatewayProxyEvent) => {
  const path = event.pathParameters?.proxy || event.resource?.split('/').pop() || '';
  const method = event.httpMethod;

  try {
    switch (true) {
      case path === 'detailed' && method === 'GET':
        return await healthHandler.getDetailedHealth(event);
      
      case path === 'performance' && method === 'GET':
        return await healthHandler.getPerformanceMetrics(event);
      
      case path === 'database' && method === 'GET':
        return await healthHandler.getDatabaseHealth(event);
      
      case path === 'storage' && method === 'GET':
        return await healthHandler.getStorageHealth(event);
      
      case path === 'services' && method === 'GET':
        return await healthHandler.getServicesOverview(event);
      
      case path === 'alerts' && method === 'GET':
        return await healthHandler.getAlerts(event);
      
      case path === 'history' && method === 'GET':
        return await healthHandler.getHealthHistory(event);
      
      case path === 'report' && method === 'POST':
        return await healthHandler.generateHealthReport(event);
      
      case path.includes('alerts') && path.includes('acknowledge') && method === 'PUT':
        return await healthHandler.acknowledgeAlert(event);
      
      default:
        // Default to basic health check
        return await healthHandler.checkHealth(event);
    }
  } catch (error) {
    // Health handler routing error - return error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      })
    };
  }
});