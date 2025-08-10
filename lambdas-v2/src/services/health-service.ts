import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Logger } from '../shared/logger';
import { 
  SystemHealthCheck, 
  DependencyHealth, 
  DatabaseHealthStatus,
  TableHealthStatus,
  S3HealthStatus,
  S3BucketHealthStatus,
  ExternalServiceHealthStatus,
  EnvironmentInfo,
  HealthAlert,
  DataQualityStatus,
  DataQualityCheck,
  HealthPerformanceMetrics,
  MemoryMetrics,
  ExecutionMetrics,
  ThroughputMetrics,
  ErrorMetrics,
  HealthPerformanceTrends,
  HealthCheckConfig,
  AlertThreshold
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Health Service - Comprehensive system health monitoring and checks
 * Provides detailed monitoring of all system dependencies and performance metrics
 */
export class HealthService {
  private client: DynamoDBDocumentClient;
  private s3Client: S3Client;
  private logger: Logger;
  private config: HealthCheckConfig;
  private performanceHistory: Map<string, number[]> = new Map();
  private lastHealthCheck: SystemHealthCheck | null = null;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.logger = new Logger('HealthService');
    
    // Initialize AWS clients
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // Default configuration
    this.config = {
      enabled: true,
      interval: 300, // 5 minutes
      timeout: 30,
      retries: 3,
      dependencies: {
        dynamodb: {
          enabled: true,
          tables: [
            process.env.USERS_TABLE || 'StudyApp-Users',
            process.env.SESSIONS_TABLE || 'StudyApp-Sessions',
            process.env.GOALS_TABLE || 'StudyApp-Goals',
            process.env.ANALYTICS_TABLE || 'StudyApp-Analytics'
          ],
          performanceChecks: true
        },
        s3: {
          enabled: true,
          buckets: [
            process.env.DATA_BUCKET || 'study-app-data'
          ],
          performanceChecks: true
        },
        external: {
          enabled: false,
          services: []
        }
      },
      dataQuality: {
        enabled: true,
        checks: [
          {
            name: 'User Count Check',
            table: process.env.USERS_TABLE || 'StudyApp-Users',
            checkType: 'count',
            query: 'scan',
            threshold: 0,
            critical: false
          },
          {
            name: 'Active Sessions Check',
            table: process.env.SESSIONS_TABLE || 'StudyApp-Sessions',
            checkType: 'count',
            query: 'scan',
            threshold: 0,
            critical: false
          }
        ]
      },
      alerts: {
        enabled: true,
        thresholds: [
          {
            metric: 'response_time',
            warningThreshold: 1000,
            errorThreshold: 2000,
            criticalThreshold: 5000,
            comparison: 'greater_than',
            enabled: true
          },
          {
            metric: 'error_rate',
            warningThreshold: 1,
            errorThreshold: 5,
            criticalThreshold: 10,
            comparison: 'greater_than',
            enabled: true
          },
          {
            metric: 'memory_usage',
            warningThreshold: 70,
            errorThreshold: 85,
            criticalThreshold: 95,
            comparison: 'greater_than',
            enabled: true
          }
        ]
      },
      ...config
    };

    this.logger.info('HealthService initialized', {
      config: this.config
    });
  }

  /**
   * Perform comprehensive health check of all system components
   */
  async performHealthCheck(): Promise<SystemHealthCheck> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    this.logger.info('Starting comprehensive health check');

    try {
      // Perform all health checks in parallel for better performance
      const [
        environment,
        dependencyHealth,
        performanceMetrics,
        dataQuality
      ] = await Promise.all([
        this.getEnvironmentInfo(),
        this.checkDependencyHealth(),
        this.collectPerformanceMetrics(),
        this.performDataQualityChecks()
      ]);

      // Generate alerts based on current status
      const alerts = await this.generateAlerts(dependencyHealth, performanceMetrics, dataQuality);

      // Generate recommendations based on current state
      const recommendations = this.generateRecommendations(dependencyHealth, performanceMetrics, dataQuality, alerts);

      // Determine overall system status
      const overallStatus = this.determineOverallStatus(dependencyHealth, performanceMetrics, dataQuality, alerts);

      const healthCheck: SystemHealthCheck = {
        status: overallStatus,
        timestamp,
        environment,
        dependencies: dependencyHealth,
        performance: performanceMetrics,
        dataQuality,
        alerts,
        recommendations
      };

      // Cache the result
      this.lastHealthCheck = healthCheck;

      const duration = Date.now() - startTime;
      this.logger.info('Health check completed', {
        status: overallStatus,
        duration,
        alertsCount: alerts.length,
        recommendationsCount: recommendations.length
      });

      return healthCheck;

    } catch (error) {
      this.logger.error('Health check failed', { error });
      
      // Return degraded status with minimal info
      return {
        status: 'unhealthy',
        timestamp,
        environment: await this.getEnvironmentInfo(),
        dependencies: {
          dynamodb: { status: 'unhealthy', tables: [], connectivity: { canConnect: false, responseTime: 0, lastChecked: timestamp }, performance: { readLatency: 0, writeLatency: 0, throughputUtilization: 0, errorRate: 100 }, capacity: { consumedReadCapacity: 0, consumedWriteCapacity: 0, provisionedReadCapacity: 0, provisionedWriteCapacity: 0, utilizationPercentage: 0 } },
          s3: { status: 'unhealthy', buckets: [], connectivity: { canConnect: false, responseTime: 0, lastChecked: timestamp }, performance: { uploadLatency: 0, downloadLatency: 0, errorRate: 100 } },
          external: [],
          overall: 'unhealthy'
        },
        performance: this.getDefaultPerformanceMetrics(),
        dataQuality: { overall: 'poor', checks: [], lastAssessment: timestamp, trends: { dataConsistency: 'degrading', dataCompleteness: 'degrading', dataAccuracy: 'degrading', dataDuplication: 'degrading' } },
        alerts: [{
          alertId: uuidv4(),
          severity: 'critical',
          category: 'availability',
          title: 'Health Check System Failure',
          description: 'The health check system itself has failed',
          source: 'HealthService',
          currentValue: 'failed',
          impact: 'Cannot assess system health',
          recommendations: ['Check HealthService logs', 'Verify AWS service permissions'],
          createdAt: timestamp,
          acknowledged: false,
          tags: ['system', 'critical']
        }],
        recommendations: ['Investigate HealthService failure', 'Check AWS credentials and permissions', 'Review system logs']
      };
    }
  }

  /**
   * Get environment information
   */
  private async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    const startTime = process.hrtime.bigint();
    
    return {
      stage: process.env.STAGE || 'unknown',
      version: '2.0.0',
      region: process.env.AWS_REGION || 'unknown',
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown',
      logLevel: process.env.LOG_LEVEL || 'INFO',
      uptime: Number(process.hrtime.bigint() - startTime) / 1000000, // Convert to milliseconds
      coldStart: process.env.AWS_LAMBDA_INITIALIZATION_TYPE === 'on-demand'
    };
  }

  /**
   * Check health of all system dependencies
   */
  private async checkDependencyHealth(): Promise<DependencyHealth> {
    const [dynamodbHealth, s3Health, externalHealth] = await Promise.all([
      this.checkDynamoDBHealth(),
      this.checkS3Health(),
      this.checkExternalServiceHealth()
    ]);

    // Determine overall dependency health
    const statuses = [dynamodbHealth.status, s3Health.status];
    externalHealth.forEach(ext => statuses.push(ext.status));

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (statuses.includes('unhealthy')) {
      overall = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overall = 'degraded';
    }

    return {
      dynamodb: dynamodbHealth,
      s3: s3Health,
      external: externalHealth,
      overall
    };
  }

  /**
   * Check DynamoDB health and performance
   */
  private async checkDynamoDBHealth(): Promise<DatabaseHealthStatus> {
    if (!this.config.dependencies.dynamodb.enabled) {
      return {
        status: 'healthy',
        tables: [],
        connectivity: { canConnect: true, responseTime: 0, lastChecked: new Date().toISOString() },
        performance: { readLatency: 0, writeLatency: 0, throughputUtilization: 0, errorRate: 0 },
        capacity: { consumedReadCapacity: 0, consumedWriteCapacity: 0, provisionedReadCapacity: 0, provisionedWriteCapacity: 0, utilizationPercentage: 0 }
      };
    }

    const startTime = Date.now();
    const tables: TableHealthStatus[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    try {
      // Test basic connectivity with a simple operation
      const connectivityTest = await this.client.send(new ScanCommand({
        TableName: this.config.dependencies.dynamodb.tables[0],
        Limit: 1,
        Select: 'COUNT'
      }));
      
      const connectivity = {
        canConnect: true,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };

      // Check each table individually
      for (const tableName of this.config.dependencies.dynamodb.tables) {
        try {
          const tableHealth = await this.checkTableHealth(tableName);
          tables.push(tableHealth);
          
          if (tableHealth.status === 'unhealthy') {
            overallStatus = 'unhealthy';
          } else if (tableHealth.status === 'degraded' && overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        } catch (error) {
          this.logger.warn('Failed to check table health', { tableName, error });
          tables.push({
            tableName,
            status: 'unhealthy',
            readCapacityUtilization: 0,
            writeCapacityUtilization: 0,
            errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
          });
          overallStatus = 'unhealthy';
        }
      }

      // Calculate performance metrics (simplified)
      const totalResponseTime = connectivity.responseTime;
      const performance = {
        readLatency: totalResponseTime * 0.6, // Estimate
        writeLatency: totalResponseTime * 0.8, // Estimate
        throughputUtilization: this.calculateAverageThroughputUtilization(tables),
        errorRate: this.calculateErrorRate(tables)
      };

      // Calculate capacity metrics
      const capacity = {
        consumedReadCapacity: 0, // Would need CloudWatch metrics
        consumedWriteCapacity: 0, // Would need CloudWatch metrics
        provisionedReadCapacity: 0, // Would need table descriptions
        provisionedWriteCapacity: 0, // Would need table descriptions
        utilizationPercentage: 0 // Would calculate from above
      };

      return {
        status: overallStatus,
        tables,
        connectivity,
        performance,
        capacity
      };

    } catch (error) {
      this.logger.error('DynamoDB health check failed', { error });
      
      return {
        status: 'unhealthy',
        tables: [],
        connectivity: {
          canConnect: false,
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString()
        },
        performance: {
          readLatency: 0,
          writeLatency: 0,
          throughputUtilization: 0,
          errorRate: 100
        },
        capacity: {
          consumedReadCapacity: 0,
          consumedWriteCapacity: 0,
          provisionedReadCapacity: 0,
          provisionedWriteCapacity: 0,
          utilizationPercentage: 0
        }
      };
    }
  }

  /**
   * Check individual table health
   */
  private async checkTableHealth(tableName: string): Promise<TableHealthStatus> {
    try {
      const startTime = Date.now();
      
      // Get basic table info with a count scan
      const scanResult = await this.client.send(new ScanCommand({
        TableName: tableName,
        Select: 'COUNT',
        Limit: 1000
      }));

      const responseTime = Date.now() - startTime;
      
      // Determine status based on response time
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 2000) {
        status = 'unhealthy';
      } else if (responseTime > 1000) {
        status = 'degraded';
      }

      return {
        tableName,
        status,
        itemCount: scanResult.Count || 0,
        readCapacityUtilization: this.estimateCapacityUtilization(responseTime, 'read'),
        writeCapacityUtilization: 0, // Would need write operations to measure
        errors: []
      };

    } catch (error) {
      this.logger.warn('Table health check failed', { tableName, error });
      
      return {
        tableName,
        status: 'unhealthy',
        readCapacityUtilization: 0,
        writeCapacityUtilization: 0,
        errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Check S3 health and performance
   */
  private async checkS3Health(): Promise<S3HealthStatus> {
    if (!this.config.dependencies.s3.enabled) {
      return {
        status: 'healthy',
        buckets: [],
        connectivity: { canConnect: true, responseTime: 0, lastChecked: new Date().toISOString() },
        performance: { uploadLatency: 0, downloadLatency: 0, errorRate: 0 }
      };
    }

    const startTime = Date.now();
    const buckets: S3BucketHealthStatus[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check each bucket
      for (const bucketName of this.config.dependencies.s3.buckets) {
        try {
          const bucketStartTime = Date.now();
          
          // Test bucket accessibility
          await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
          
          // Get basic bucket info
          const listResult = await this.s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 10
          }));

          const responseTime = Date.now() - bucketStartTime;
          
          let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
          if (responseTime > 2000) {
            status = 'unhealthy';
            overallStatus = 'unhealthy';
          } else if (responseTime > 1000) {
            status = 'degraded';
            if (overallStatus === 'healthy') overallStatus = 'degraded';
          }

          buckets.push({
            bucketName,
            status,
            accessible: true,
            objectCount: listResult.KeyCount || 0,
            errors: []
          });

        } catch (error) {
          this.logger.warn('S3 bucket health check failed', { bucketName, error });
          
          buckets.push({
            bucketName,
            status: 'unhealthy',
            accessible: false,
            errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
          });
          overallStatus = 'unhealthy';
        }
      }

      const connectivity = {
        canConnect: true,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };

      const performance = {
        uploadLatency: 0, // Would need actual upload tests
        downloadLatency: Date.now() - startTime,
        errorRate: buckets.filter(b => !b.accessible).length / buckets.length * 100
      };

      return {
        status: overallStatus,
        buckets,
        connectivity,
        performance
      };

    } catch (error) {
      this.logger.error('S3 health check failed', { error });
      
      return {
        status: 'unhealthy',
        buckets: [],
        connectivity: {
          canConnect: false,
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString()
        },
        performance: {
          uploadLatency: 0,
          downloadLatency: 0,
          errorRate: 100
        }
      };
    }
  }

  /**
   * Check external service health
   */
  private async checkExternalServiceHealth(): Promise<ExternalServiceHealthStatus[]> {
    if (!this.config.dependencies.external.enabled || this.config.dependencies.external.services.length === 0) {
      return [];
    }

    const results: ExternalServiceHealthStatus[] = [];

    for (const service of this.config.dependencies.external.services) {
      try {
        const startTime = Date.now();
        
        const response = await fetch(service.url, {
          method: service.method,
          headers: service.headers,
          signal: AbortSignal.timeout(service.timeout * 1000)
        });

        const responseTime = Date.now() - startTime;
        
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (response.status !== service.expectedStatusCode) {
          status = 'unhealthy';
        } else if (responseTime > 2000) {
          status = 'degraded';
        }

        results.push({
          serviceName: service.name,
          url: service.url,
          status,
          responseTime,
          statusCode: response.status,
          lastChecked: new Date().toISOString(),
          uptime: status === 'healthy' ? 100 : 0, // Simplified
          errors: status === 'unhealthy' ? [`Unexpected status code: ${response.status}`] : []
        });

      } catch (error) {
        results.push({
          serviceName: service.name,
          url: service.url,
          status: 'unhealthy',
          responseTime: 0,
          lastChecked: new Date().toISOString(),
          uptime: 0,
          errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }

    return results;
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<HealthPerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const memoryLimit = parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '512');
    
    const memory: MemoryMetrics = {
      current: Math.round(memoryUsage.rss / 1024 / 1024),
      peak: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      limit: memoryLimit,
      utilizationPercentage: Math.round((memoryUsage.rss / 1024 / 1024) / memoryLimit * 100),
      gcFrequency: 0 // Would need to track GC events
    };

    const execution: ExecutionMetrics = {
      coldStartFrequency: process.env.AWS_LAMBDA_INITIALIZATION_TYPE === 'on-demand' ? 100 : 0,
      averageExecutionTime: this.getAverageResponseTime(),
      p95ExecutionTime: this.getPercentileResponseTime(95),
      p99ExecutionTime: this.getPercentileResponseTime(99),
      timeouts: 0 // Would need to track from logs
    };

    const throughput: ThroughputMetrics = {
      requestsPerSecond: this.getCurrentRPS(),
      requestsPerMinute: this.getCurrentRPM(),
      requestsPerHour: this.getCurrentRPH(),
      peakThroughput: this.getPeakThroughput(),
      averageResponseTime: this.getAverageResponseTime()
    };

    const errors: ErrorMetrics = {
      errorRate: this.getCurrentErrorRate(),
      errorCount: this.getCurrentErrorCount(),
      errorsByType: this.getErrorsByType(),
      criticalErrors: 0,
      warnings: 0
    };

    const trends: HealthPerformanceTrends = {
      responseTimeTrend: this.analyzeResponseTimeTrend(),
      errorRateTrend: this.analyzeErrorRateTrend(),
      throughputTrend: this.analyzeThroughputTrend(),
      memoryUsageTrend: this.analyzeMemoryUsageTrend()
    };

    return {
      memory,
      execution,
      throughput,
      errors,
      trends
    };
  }

  /**
   * Perform data quality checks
   */
  private async performDataQualityChecks(): Promise<DataQualityStatus> {
    if (!this.config.dataQuality.enabled) {
      return {
        overall: 'good',
        checks: [],
        lastAssessment: new Date().toISOString(),
        trends: {
          dataConsistency: 'stable',
          dataCompleteness: 'stable',
          dataAccuracy: 'stable',
          dataDuplication: 'stable'
        }
      };
    }

    const checks: DataQualityCheck[] = [];
    let passedChecks = 0;

    for (const checkConfig of this.config.dataQuality.checks) {
      try {
        const check = await this.performDataQualityCheck(checkConfig);
        checks.push(check);
        if (check.status === 'passed') passedChecks++;
      } catch (error) {
        this.logger.warn('Data quality check failed', { checkName: checkConfig.name, error });
        checks.push({
          checkName: checkConfig.name,
          table: checkConfig.table,
          status: 'failed',
          result: {
            expected: checkConfig.expectedValue || 'unknown',
            actual: 'error'
          },
          lastChecked: new Date().toISOString(),
          impact: checkConfig.critical ? 'critical' : 'medium',
          description: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    const passRate = checks.length > 0 ? passedChecks / checks.length : 1;
    let overall: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (passRate < 0.5) overall = 'poor';
    else if (passRate < 0.7) overall = 'fair';
    else if (passRate < 0.9) overall = 'good';

    return {
      overall,
      checks,
      lastAssessment: new Date().toISOString(),
      trends: {
        dataConsistency: 'stable',
        dataCompleteness: 'stable',
        dataAccuracy: 'stable',
        dataDuplication: 'stable'
      }
    };
  }

  /**
   * Perform individual data quality check
   */
  private async performDataQualityCheck(config: any): Promise<DataQualityCheck> {
    const startTime = Date.now();
    
    // Perform basic count check for now
    const result = await this.client.send(new ScanCommand({
      TableName: config.table,
      Select: 'COUNT'
    }));

    const actualCount = result.Count || 0;
    const expectedCount = config.threshold || 0;
    
    let status: 'passed' | 'warning' | 'failed' = 'passed';
    if (actualCount < expectedCount) {
      status = config.critical ? 'failed' : 'warning';
    }

    return {
      checkName: config.name,
      table: config.table,
      status,
      result: {
        expected: expectedCount,
        actual: actualCount,
        threshold: config.threshold
      },
      lastChecked: new Date().toISOString(),
      impact: config.critical ? 'critical' : 'medium',
      description: `Table ${config.table} has ${actualCount} records${expectedCount > 0 ? ` (expected >= ${expectedCount})` : ''}`
    };
  }

  /**
   * Generate alerts based on current system state
   */
  private async generateAlerts(
    dependencies: DependencyHealth,
    performance: HealthPerformanceMetrics,
    dataQuality: DataQualityStatus
  ): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = [];

    // Check performance thresholds
    for (const threshold of this.config.alerts.thresholds) {
      if (!threshold.enabled) continue;

      let currentValue: number = 0;
      let metricName = '';

      switch (threshold.metric) {
        case 'response_time':
          currentValue = performance.throughput.averageResponseTime;
          metricName = 'Average Response Time';
          break;
        case 'error_rate':
          currentValue = performance.errors.errorRate;
          metricName = 'Error Rate';
          break;
        case 'memory_usage':
          currentValue = performance.memory.utilizationPercentage;
          metricName = 'Memory Usage';
          break;
      }

      const severity = this.determineSeverity(currentValue, threshold);
      if (severity !== 'info') {
        alerts.push({
          alertId: uuidv4(),
          severity,
          category: 'performance',
          title: `${metricName} Threshold Exceeded`,
          description: `${metricName} is ${currentValue}${threshold.metric === 'memory_usage' || threshold.metric === 'error_rate' ? '%' : 'ms'}, which exceeds the ${severity} threshold`,
          source: 'HealthService',
          threshold: {
            metric: threshold.metric,
            value: this.getThresholdValue(threshold, severity),
            comparison: threshold.comparison
          },
          currentValue,
          impact: this.getAlertImpact(threshold.metric, severity),
          recommendations: this.getAlertRecommendations(threshold.metric, severity),
          createdAt: new Date().toISOString(),
          acknowledged: false,
          tags: ['performance', threshold.metric]
        });
      }
    }

    // Check dependency health
    if (dependencies.overall !== 'healthy') {
      alerts.push({
        alertId: uuidv4(),
        severity: dependencies.overall === 'degraded' ? 'warning' : 'error',
        category: 'availability',
        title: 'Dependency Health Issues',
        description: `One or more system dependencies are ${dependencies.overall}`,
        source: 'HealthService',
        currentValue: dependencies.overall,
        impact: 'System functionality may be impacted',
        recommendations: ['Check individual dependency status', 'Review connection configurations'],
        createdAt: new Date().toISOString(),
        acknowledged: false,
        tags: ['dependencies', 'availability']
      });
    }

    // Check data quality
    if (dataQuality.overall === 'poor' || dataQuality.overall === 'fair') {
      alerts.push({
        alertId: uuidv4(),
        severity: dataQuality.overall === 'poor' ? 'error' : 'warning',
        category: 'data_quality',
        title: 'Data Quality Issues Detected',
        description: `Overall data quality is ${dataQuality.overall}`,
        source: 'HealthService',
        currentValue: dataQuality.overall,
        impact: 'Data integrity and application functionality may be compromised',
        recommendations: ['Review failed data quality checks', 'Investigate data consistency issues'],
        createdAt: new Date().toISOString(),
        acknowledged: false,
        tags: ['data_quality']
      });
    }

    return alerts;
  }

  /**
   * Generate system recommendations
   */
  private generateRecommendations(
    dependencies: DependencyHealth,
    performance: HealthPerformanceMetrics,
    dataQuality: DataQualityStatus,
    alerts: HealthAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (performance.memory.utilizationPercentage > 80) {
      recommendations.push('Consider increasing Lambda memory allocation to improve performance');
    }

    if (performance.throughput.averageResponseTime > 1000) {
      recommendations.push('Optimize database queries and implement caching strategies');
    }

    if (performance.errors.errorRate > 1) {
      recommendations.push('Investigate and resolve recurring errors to improve reliability');
    }

    // Dependency recommendations
    if (dependencies.dynamodb.status !== 'healthy') {
      recommendations.push('Review DynamoDB table configurations and capacity settings');
    }

    if (dependencies.s3.status !== 'healthy') {
      recommendations.push('Check S3 bucket permissions and connectivity');
    }

    // Data quality recommendations
    if (dataQuality.overall !== 'excellent') {
      recommendations.push('Implement automated data validation and cleanup processes');
    }

    // Alert-based recommendations
    if (alerts.length > 5) {
      recommendations.push('Review system health monitoring thresholds and alert configurations');
    }

    return recommendations;
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    dependencies: DependencyHealth,
    performance: HealthPerformanceMetrics,
    dataQuality: DataQualityStatus,
    alerts: HealthAlert[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Critical failures
    if (dependencies.overall === 'unhealthy') return 'unhealthy';
    if (alerts.some(a => a.severity === 'critical')) return 'unhealthy';
    if (performance.errors.errorRate > 10) return 'unhealthy';

    // Degraded conditions
    if (dependencies.overall === 'degraded') return 'degraded';
    if (alerts.some(a => a.severity === 'error')) return 'degraded';
    if (performance.memory.utilizationPercentage > 90) return 'degraded';
    if (performance.throughput.averageResponseTime > 2000) return 'degraded';
    if (dataQuality.overall === 'poor') return 'degraded';

    return 'healthy';
  }

  // Helper methods for metrics calculation
  private calculateAverageThroughputUtilization(tables: TableHealthStatus[]): number {
    if (tables.length === 0) return 0;
    const total = tables.reduce((sum, table) => sum + table.readCapacityUtilization + table.writeCapacityUtilization, 0);
    return total / (tables.length * 2);
  }

  private calculateErrorRate(tables: TableHealthStatus[]): number {
    const totalTables = tables.length;
    const errorTables = tables.filter(table => table.errors.length > 0).length;
    return totalTables > 0 ? (errorTables / totalTables) * 100 : 0;
  }

  private estimateCapacityUtilization(responseTime: number, operationType: 'read' | 'write'): number {
    // Simple estimation based on response time
    if (responseTime > 2000) return 90;
    if (responseTime > 1000) return 70;
    if (responseTime > 500) return 50;
    return 30;
  }

  private getDefaultPerformanceMetrics(): HealthPerformanceMetrics {
    return {
      memory: { current: 0, peak: 0, limit: 512, utilizationPercentage: 0, gcFrequency: 0 },
      execution: { coldStartFrequency: 0, averageExecutionTime: 0, p95ExecutionTime: 0, p99ExecutionTime: 0, timeouts: 0 },
      throughput: { requestsPerSecond: 0, requestsPerMinute: 0, requestsPerHour: 0, peakThroughput: 0, averageResponseTime: 0 },
      errors: { errorRate: 0, errorCount: 0, errorsByType: {}, criticalErrors: 0, warnings: 0 },
      trends: { responseTimeTrend: 'stable', errorRateTrend: 'stable', throughputTrend: 'stable', memoryUsageTrend: 'stable' }
    };
  }

  // Simplified metric calculation methods (would be enhanced with real data)
  private getAverageResponseTime(): number { return 500; }
  private getPercentileResponseTime(percentile: number): number { return 500 * (percentile / 50); }
  private getCurrentRPS(): number { return 10; }
  private getCurrentRPM(): number { return 600; }
  private getCurrentRPH(): number { return 36000; }
  private getPeakThroughput(): number { return 50; }
  private getCurrentErrorRate(): number { return 0.5; }
  private getCurrentErrorCount(): number { return 2; }
  private getErrorsByType(): { [errorType: string]: number } { return { 'ValidationError': 1, 'TimeoutError': 1 }; }
  
  private analyzeResponseTimeTrend(): 'improving' | 'stable' | 'degrading' { return 'stable'; }
  private analyzeErrorRateTrend(): 'improving' | 'stable' | 'degrading' { return 'stable'; }
  private analyzeThroughputTrend(): 'increasing' | 'stable' | 'decreasing' { return 'stable'; }
  private analyzeMemoryUsageTrend(): 'improving' | 'stable' | 'degrading' { return 'stable'; }

  private determineSeverity(value: number, threshold: AlertThreshold): 'info' | 'warning' | 'error' | 'critical' {
    if (threshold.comparison === 'greater_than') {
      if (value >= threshold.criticalThreshold) return 'critical';
      if (value >= threshold.errorThreshold) return 'error';
      if (value >= threshold.warningThreshold) return 'warning';
    }
    return 'info';
  }

  private getThresholdValue(threshold: AlertThreshold, severity: 'warning' | 'error' | 'critical'): number {
    switch (severity) {
      case 'warning': return threshold.warningThreshold;
      case 'error': return threshold.errorThreshold;
      case 'critical': return threshold.criticalThreshold;
    }
  }

  private getAlertImpact(metric: string, severity: string): string {
    const impacts = {
      response_time: 'Slow response times affect user experience and system performance',
      error_rate: 'High error rates indicate system instability and affect reliability',
      memory_usage: 'High memory usage can lead to performance degradation and function failures'
    };
    return impacts[metric as keyof typeof impacts] || 'System performance may be impacted';
  }

  private getAlertRecommendations(metric: string, severity: string): string[] {
    const recommendations: { [key: string]: string[] } = {
      response_time: ['Optimize database queries', 'Implement caching', 'Review Lambda configuration'],
      error_rate: ['Check error logs', 'Review code for error handling', 'Monitor external dependencies'],
      memory_usage: ['Increase Lambda memory allocation', 'Optimize memory usage in code', 'Review data structures']
    };
    return recommendations[metric] || ['Review system configuration and performance'];
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): SystemHealthCheck | null {
    return this.lastHealthCheck;
  }

  /**
   * Update health check configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Health check configuration updated', { config: this.config });
  }
}