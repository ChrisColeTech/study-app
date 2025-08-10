// Health service implementation for system monitoring

import { IHealthService, ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { HeadBucketCommand } from '@aws-sdk/client-s3';

export class HealthService implements IHealthService {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ service: 'HealthService' });

  constructor(serviceFactory: ServiceFactory) {
    this.serviceFactory = serviceFactory;
  }

  /**
   * Perform comprehensive health check
   */
  public async checkHealth() {
    this.logger.info('Starting health check');
    
    const startTime = Date.now();
    const config = this.serviceFactory.getConfig();

    // Run health checks in parallel
    const [databaseHealth, storageHealth] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkStorageHealth(),
    ]);

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.environment,
      version: process.env.AWS_LAMBDA_FUNCTION_VERSION || '1.0.0',
      dependencies: {
        database: databaseHealth.status === 'fulfilled' 
          ? databaseHealth.value 
          : { status: 'error', error: databaseHealth.reason?.message },
        storage: storageHealth.status === 'fulfilled'
          ? storageHealth.value
          : { status: 'error', error: storageHealth.reason?.message },
      },
    };

    // Determine overall status
    const hasUnhealthyDependencies = [
      response.dependencies.database,
      response.dependencies.storage,
    ].some(dep => dep.status !== 'healthy');

    if (hasUnhealthyDependencies) {
      response.status = 'degraded';
    }

    const totalTime = Date.now() - startTime;
    this.logger.info('Health check completed', { 
      status: response.status,
      totalTime,
      dependencies: Object.keys(response.dependencies).map(key => ({
        name: key,
        status: response.dependencies[key as keyof typeof response.dependencies].status,
      })),
    });

    return response;
  }

  /**
   * Check database (DynamoDB) health
   */
  public async checkDatabaseHealth(): Promise<{ status: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Checking database health');
      const config = this.serviceFactory.getConfig();
      const dynamoClient = this.serviceFactory.getDynamoClient();

      // Check primary table (users table) to verify connectivity
      if (!config.tables.users) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
        };
      }

      // Use DescribeTable to check connectivity without reading data
      await dynamoClient.send(new DescribeTableCommand({
        TableName: config.tables.users,
      }));

      const responseTime = Date.now() - startTime;
      this.logger.debug('Database health check passed', { responseTime });

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Database health check failed', error, { responseTime });
      
      return {
        status: 'unhealthy',
        responseTime,
      };
    }
  }

  /**
   * Check storage (S3) health
   */
  public async checkStorageHealth(): Promise<{ status: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Checking storage health');
      const config = this.serviceFactory.getConfig();
      const s3Client = this.serviceFactory.getS3Client();

      // Check primary bucket (question data bucket) to verify connectivity
      if (!config.buckets.questionData) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
        };
      }

      // Use HeadBucket to check connectivity without reading data
      await s3Client.send(new HeadBucketCommand({
        Bucket: config.buckets.questionData,
      }));

      const responseTime = Date.now() - startTime;
      this.logger.debug('Storage health check passed', { responseTime });

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Storage health check failed', error, { responseTime });
      
      return {
        status: 'unhealthy',
        responseTime,
      };
    }
  }
}