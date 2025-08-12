// Health repository for AWS service health checks

import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { CloudWatchLogsClient, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { 
  ServiceDiagnostics,
  DatabaseDiagnostics, 
  StorageDiagnostics, 
  LambdaDiagnostics, 
  CloudWatchDiagnostics,
  SystemResourceUsage,
  PerformanceMetrics,
  HealthTrend,
  IHealthRepository,
  IDetailedHealthRepository
} from '../shared/types/health.types';
import * as os from 'os';
import * as dns from 'dns';
import { promisify } from 'util';

// Re-export interfaces for external use
export type { IHealthRepository, IDetailedHealthRepository } from '../shared/types/health.types';

export class HealthRepository implements IHealthRepository, IDetailedHealthRepository {
  private dynamoClient: DynamoDBClient;
  private s3Client: S3Client;
  private config: ServiceConfig;
  private logger = createLogger({ component: 'HealthRepository' });

  // Helper services for specialized concerns
  private healthMonitoring: HealthMonitoringService;
  private connectivityTester: HealthConnectivityTester;
  private configurationValidator: HealthConfigurationValidator;
  private metricsCollector: HealthMetricsCollector;

  constructor(dynamoClient: DynamoDBClient, s3Client: S3Client, config: ServiceConfig) {
    this.dynamoClient = dynamoClient;
    this.s3Client = s3Client;
    this.config = config;
    
    // Initialize helper services with proper dependencies
    this.healthMonitoring = new HealthMonitoringService(this.config);
    this.connectivityTester = new HealthConnectivityTester(this.dynamoClient, this.config);
    this.configurationValidator = new HealthConfigurationValidator(this.config);
    this.metricsCollector = new HealthMetricsCollector(this);
  }

  /**
   * Check DynamoDB health by describing the Users table
   */
  async checkDynamoDbHealth(): Promise<ServiceDiagnostics> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Checking DynamoDB health', { tableName: this.config.tables.users });

      const command = new DescribeTableCommand({
        TableName: this.config.tables.users
      });

      await this.dynamoClient.send(command);
      const responseTime = Date.now() - startTime;

      this.logger.debug('DynamoDB health check successful', { responseTime });

      return {
        service: 'dynamodb',
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      this.logger.error('DynamoDB health check failed', error as Error, { 
        responseTime,
        tableName: this.config.tables.users 
      });

      return {
        service: 'dynamodb',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: errorMessage
      };
    }
  }

  /**
   * Get detailed DynamoDB diagnostics
   */
  async getDetailedDynamoDbHealth(): Promise<DatabaseDiagnostics> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Getting detailed DynamoDB diagnostics');

      const tableNames = [
        this.config.tables.users,
        this.config.tables.studySessions,
        this.config.tables.userProgress,
        this.config.tables.goals
      ];

      const tables = await Promise.allSettled(
        tableNames.map(async (tableName) => {
          const command = new DescribeTableCommand({ TableName: tableName });
          const result = await this.dynamoClient.send(command);
          const table = result.Table!;
          
          return {
            name: tableName,
            status: table.TableStatus || 'UNKNOWN',
            itemCount: table.ItemCount || 0,
            sizeBytes: table.TableSizeBytes || 0,
            readCapacity: table.ProvisionedThroughput?.ReadCapacityUnits || 0,
            writeCapacity: table.ProvisionedThroughput?.WriteCapacityUnits || 0
          };
        })
      );

      const responseTime = Date.now() - startTime;
      const successfulTables = tables.filter(t => t.status === 'fulfilled');
      const status = successfulTables.length === tableNames.length ? 'healthy' : 
                   successfulTables.length > 0 ? 'degraded' : 'unhealthy';

      return {
        service: 'dynamodb',
        status,
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          region: this.config.region,
          tables: tables.map(t => t.status === 'fulfilled' ? t.value : {
            name: 'unknown',
            status: 'ERROR'
          })
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        service: 'dynamodb',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Check S3 health by checking bucket access
   */
  async checkS3Health(): Promise<ServiceDiagnostics> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Checking S3 health', { bucketName: this.config.s3.bucketName });

      const command = new HeadBucketCommand({
        Bucket: this.config.s3.bucketName
      });

      await this.s3Client.send(command);
      const responseTime = Date.now() - startTime;

      this.logger.debug('S3 health check successful', { responseTime });

      return {
        service: 's3',
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      this.logger.error('S3 health check failed', error as Error, { 
        responseTime,
        bucketName: this.config.s3.bucketName 
      });

      return {
        service: 's3',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: errorMessage
      };
    }
  }

  /**
   * Check all AWS services health
   */
  async checkAllServices(): Promise<ServiceDiagnostics[]> {
    this.logger.info('Running comprehensive health checks');
    
    // Run health checks in parallel for better performance
    const healthChecks = await Promise.allSettled([
      this.checkDynamoDbHealth(),
      this.checkS3Health()
    ]);

    const results: ServiceDiagnostics[] = [];

    healthChecks.forEach((check, index) => {
      if (check.status === 'fulfilled') {
        results.push(check.value);
      } else {
        // Handle rejected promises
        const serviceName = index === 0 ? 'dynamodb' : 's3';
        results.push({
          service: serviceName,
          status: 'unhealthy',
          responseTime: 0,
          lastChecked: new Date().toISOString(),
          error: check.reason?.message || 'Health check failed'
        });
      }
    });

    const healthyServices = results.filter(r => r.status === 'healthy').length;
    const totalServices = results.length;

    this.logger.info('Health checks completed', { 
      healthyServices, 
      totalServices,
      overallHealth: healthyServices === totalServices ? 'healthy' : 'degraded'
    });

    return results;
  }

  /**
   * Get detailed S3 diagnostics
   */
  async getDetailedS3Health(): Promise<StorageDiagnostics> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Getting detailed S3 diagnostics');

      const bucketNames = [
        this.config.buckets.questionData,
        this.config.buckets.assets
      ];

      const buckets = await Promise.allSettled(
        bucketNames.map(async (bucketName) => {
          if (!bucketName) return { name: 'undefined', status: 'NOT_CONFIGURED' };
          
          const headCommand = new HeadBucketCommand({ Bucket: bucketName });
          await this.s3Client.send(headCommand);
          
          // Get bucket size (simplified - just count objects)
          const listCommand = new ListObjectsV2Command({ 
            Bucket: bucketName,
            MaxKeys: 1000
          });
          const listResult = await this.s3Client.send(listCommand);
          
          return {
            name: bucketName,
            status: 'ACTIVE',
            objectCount: listResult.KeyCount || 0,
            sizeBytes: listResult.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0,
            region: this.config.region
          };
        })
      );

      const responseTime = Date.now() - startTime;
      const successfulBuckets = buckets.filter(b => b.status === 'fulfilled');
      const status = successfulBuckets.length === bucketNames.length ? 'healthy' : 
                   successfulBuckets.length > 0 ? 'degraded' : 'unhealthy';

      return {
        service: 's3',
        status,
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          region: this.config.region,
          buckets: buckets.map(b => b.status === 'fulfilled' ? b.value : {
            name: 'unknown',
            status: 'ERROR'
          })
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        service: 's3',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  // Delegate to specialized health monitoring service
  async checkLambdaHealth(): Promise<LambdaDiagnostics> {
    return this.healthMonitoring.checkLambdaHealth();
  }

  async checkCloudWatchHealth(): Promise<CloudWatchDiagnostics> {
    return this.healthMonitoring.checkCloudWatchHealth();
  }

  async getSystemMetrics(): Promise<SystemResourceUsage> {
    return this.healthMonitoring.getSystemMetrics();
  }

  // Delegate to connectivity tester
  async testConnectivity(): Promise<{ internet: boolean; aws: boolean; dns: boolean }> {
    return this.connectivityTester.testConnectivity();
  }

  // Delegate to configuration validator
  async validateConfiguration(): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }> {
    return this.configurationValidator.validateConfiguration();
  }

  // Delegate to metrics collector
  async getPerformanceMetrics(service?: string): Promise<PerformanceMetrics> {
    return this.metricsCollector.getPerformanceMetrics(service);
  }

  async getHealthTrends(service?: string, hours = 24): Promise<any[]> {
    return this.metricsCollector.getHealthTrends(service, hours);
  }
}

/**
 * HealthMonitoringService - Advanced monitoring capabilities
 * Handles Lambda, CloudWatch diagnostics and system metrics
 */
export class HealthMonitoringService {
  private lambdaClient: LambdaClient;
  private cloudwatchClient: CloudWatchLogsClient;
  private config: ServiceConfig;
  private logger = createLogger({ component: 'HealthMonitoringService' });

  constructor(config: ServiceConfig) {
    this.config = config;
    this.lambdaClient = new LambdaClient({ region: this.config.region });
    this.cloudwatchClient = new CloudWatchLogsClient({ region: this.config.region });
  }

  /**
   * Check Lambda health and get detailed diagnostics
   */
  async checkLambdaHealth(): Promise<LambdaDiagnostics> {
    const startTime = Date.now();
    
    try {
      const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (!functionName) {
        return {
          service: 'lambda',
          status: 'unhealthy',
          responseTime: 0,
          lastChecked: new Date().toISOString(),
          error: 'Lambda function name not found in environment'
        };
      }

      const command = new GetFunctionCommand({
        FunctionName: functionName
      });

      const result = await this.lambdaClient.send(command);
      const responseTime = Date.now() - startTime;

      return {
        service: 'lambda',
        status: result.Configuration?.State === 'Active' ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          region: this.config.region,
          functionName,
          ...(result.Configuration?.Runtime && { runtime: result.Configuration.Runtime }),
          ...(result.Configuration?.MemorySize && { memorySize: result.Configuration.MemorySize }),
          ...(result.Configuration?.Timeout && { timeout: result.Configuration.Timeout }),
          ...(result.Configuration?.CodeSize && { codeSize: result.Configuration.CodeSize }),
          ...(result.Configuration?.LastModified && { lastModified: result.Configuration.LastModified }),
          ...(result.Configuration?.State && { state: result.Configuration.State }),
          environment: result.Configuration?.Environment?.Variables || {}
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        service: 'lambda',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Check CloudWatch health and get detailed diagnostics
   */
  async checkCloudWatchHealth(): Promise<CloudWatchDiagnostics> {
    const startTime = Date.now();
    
    try {
      const command = new DescribeLogGroupsCommand({
        limit: 10
      });

      const result = await this.cloudwatchClient.send(command);
      const responseTime = Date.now() - startTime;

      const logGroups = result.logGroups?.map(lg => ({
        name: lg.logGroupName || 'unknown',
        ...(lg.retentionInDays && { retentionInDays: lg.retentionInDays }),
        ...(lg.storedBytes && { sizeBytes: lg.storedBytes })
      })) || [];

      return {
        service: 'cloudwatch',
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          region: this.config.region,
          logGroups
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        service: 'cloudwatch',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Get system resource metrics
   */
  async getSystemMetrics(): Promise<SystemResourceUsage> {
    const memoryUsage = process.memoryUsage();
    
    return {
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
        loadAverage: os.loadavg()
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
      },
      heap: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        limit: Math.round((process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ? 
                          parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) : 512)),
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      }
    };
  }
}

/**
 * HealthConnectivityTester - Network and connectivity testing
 * Handles DNS resolution, AWS connectivity, and internet connectivity tests
 */
export class HealthConnectivityTester {
  private dynamoClient: DynamoDBClient;
  private config: ServiceConfig;
  private logger = createLogger({ component: 'HealthConnectivityTester' });
  private dnsLookup = promisify(dns.lookup);

  constructor(dynamoClient: DynamoDBClient, config: ServiceConfig) {
    this.dynamoClient = dynamoClient;
    this.config = config;
  }

  /**
   * Test network connectivity
   */
  async testConnectivity(): Promise<{ internet: boolean; aws: boolean; dns: boolean }> {
    const tests = await Promise.allSettled([
      this.testDnsResolution(),
      this.testAwsConnectivity(),
      this.testInternetConnectivity()
    ]);

    return {
      dns: tests[0].status === 'fulfilled' ? tests[0].value : false,
      aws: tests[1].status === 'fulfilled' ? tests[1].value : false,
      internet: tests[2].status === 'fulfilled' ? tests[2].value : false
    };
  }

  /**
   * Test DNS resolution
   */
  private async testDnsResolution(): Promise<boolean> {
    try {
      await this.dnsLookup('google.com');
      return true;
    } catch (error) {
      this.logger.debug('DNS test failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Test AWS connectivity
   */
  private async testAwsConnectivity(): Promise<boolean> {
    try {
      const command = new DescribeTableCommand({
        TableName: this.config.tables.users
      });
      await this.dynamoClient.send(command);
      return true;
    } catch (error) {
      this.logger.debug('AWS connectivity test failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Test general internet connectivity
   */
  private async testInternetConnectivity(): Promise<boolean> {
    try {
      await this.dnsLookup('aws.amazon.com');
      return true;
    } catch (error) {
      this.logger.debug('Internet connectivity test failed', { error: (error as Error).message });
      return false;
    }
  }
}

/**
 * HealthConfigurationValidator - Configuration validation logic
 * Handles environment variable validation and configuration checks
 */
export class HealthConfigurationValidator {
  private config: ServiceConfig;
  private logger = createLogger({ component: 'HealthConfigurationValidator' });

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  /**
   * Validate system configuration
   */
  async validateConfiguration(): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required environment variables
    const requiredEnvVars = [
      'AWS_REGION',
      'USERS_TABLE_NAME',
      'STUDY_SESSIONS_TABLE_NAME',
      'USER_PROGRESS_TABLE_NAME',
      'GOALS_TABLE_NAME',
      'QUESTION_DATA_BUCKET_NAME'
    ];

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
      }
    });

    // Check table names
    Object.entries(this.config.tables).forEach(([key, value]) => {
      if (!value) {
        errors.push(`Table configuration missing: ${key}`);
      }
    });

    // Check bucket names
    Object.entries(this.config.buckets).forEach(([key, value]) => {
      if (!value) {
        warnings.push(`Bucket configuration missing: ${key}`);
      }
    });

    // Check Lambda function environment
    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
      warnings.push('Lambda function name not available in environment');
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors }),
      ...(warnings.length > 0 && { warnings })
    };
  }
}

/**
 * HealthMetricsCollector - Performance metrics and trend analysis
 * Handles performance metrics calculation and health trend analysis
 */
export class HealthMetricsCollector {
  private healthRepository: HealthRepository;
  private logger = createLogger({ component: 'HealthMetricsCollector' });

  constructor(healthRepository: HealthRepository) {
    this.healthRepository = healthRepository;
  }

  /**
   * Get performance metrics for a service
   */
  async getPerformanceMetrics(service?: string): Promise<PerformanceMetrics> {
    // This is a simplified implementation
    // In a real system, you might collect metrics from CloudWatch or other monitoring systems
    
    const startTime = Date.now();
    
    try {
      if (service === 'dynamodb' || !service) {
        await this.healthRepository.checkDynamoDbHealth();
      }
      if (service === 's3' || !service) {
        await this.healthRepository.checkS3Health();
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        responseTime,
        throughput: 0, // Would be calculated from real metrics
        errorRate: 0,
        availability: 100,
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        responseTime,
        throughput: 0,
        errorRate: 100,
        availability: 0,
        totalRequests: 1,
        successfulRequests: 0,
        failedRequests: 1
      };
    }
  }

  /**
   * Get health trends (simplified implementation)
   */
  async getHealthTrends(service?: string, hours = 24): Promise<any[]> {
    // This would typically query CloudWatch metrics or a time-series database
    // For now, return empty array as this is beyond the scope of this phase
    this.logger.debug('Health trends requested', { service, hours });
    return [];
  }
}
