// Health repository for AWS service health checks

import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
}

export interface IHealthRepository {
  checkDynamoDbHealth(): Promise<HealthCheckResult>;
  checkS3Health(): Promise<HealthCheckResult>;
  checkAllServices(): Promise<HealthCheckResult[]>;
}

export class HealthRepository implements IHealthRepository {
  private dynamoClient: DynamoDBClient;
  private s3Client: S3Client;
  private config: ServiceConfig;
  private logger = createLogger({ component: 'HealthRepository' });

  constructor(dynamoClient: DynamoDBClient, s3Client: S3Client, config: ServiceConfig) {
    this.dynamoClient = dynamoClient;
    this.s3Client = s3Client;
    this.config = config;
  }

  /**
   * Check DynamoDB health by describing the Users table
   */
  async checkDynamoDbHealth(): Promise<HealthCheckResult> {
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
        responseTime
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
        error: errorMessage
      };
    }
  }

  /**
   * Check S3 health by checking bucket access
   */
  async checkS3Health(): Promise<HealthCheckResult> {
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
        responseTime
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
        error: errorMessage
      };
    }
  }

  /**
   * Check all AWS services health
   */
  async checkAllServices(): Promise<HealthCheckResult[]> {
    this.logger.info('Running comprehensive health checks');
    
    // Run health checks in parallel for better performance
    const healthChecks = await Promise.allSettled([
      this.checkDynamoDbHealth(),
      this.checkS3Health()
    ]);

    const results: HealthCheckResult[] = [];

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
}