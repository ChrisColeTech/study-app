// Health service implementation for system monitoring

import { IHealthService } from '../shared/service-factory';
import { IHealthRepository } from '../repositories/health.repository';
import { 
  IDetailedHealthService,
  IDetailedHealthRepository,
  DetailedHealthCheckResult,
  HealthCheckOptions,
  SystemResourceUsage,
  ServiceDiagnostics,
  PerformanceMetrics,
  HealthAlert,
  HealthTrend
} from '../shared/types/health.types';
import { createLogger } from '../shared/logger';

export class HealthService implements IHealthService {
  private logger = createLogger({ service: 'HealthService' });

  constructor(private healthRepository: IHealthRepository & IDetailedHealthRepository) {}

  /**
   * Perform comprehensive health check
   */
  public async checkHealth() {
    this.logger.info('Starting health check');
    
    const startTime = Date.now();

    try {
      // Get health check results from repository
      const healthResults = await this.healthRepository.checkAllServices();
      
      // Transform results into response format
      const dependencies: { [key: string]: any } = {};
      
      healthResults.forEach(result => {
        dependencies[result.service] = {
          status: result.status === 'healthy' ? 'healthy' : 'error',
          responseTime: result.responseTime,
          error: result.error
        };
      });

      const response = {
        status: 'healthy' as string,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.AWS_LAMBDA_FUNCTION_VERSION || '1.0.0',
        dependencies
      };

      // Determine overall status
      const hasUnhealthyDependencies = healthResults.some(result => result.status !== 'healthy');
      if (hasUnhealthyDependencies) {
        response.status = 'degraded';
      }

      const totalTime = Date.now() - startTime;
      this.logger.info('Health check completed', { 
        status: response.status,
        totalTime,
        dependencies: healthResults.map(result => ({
          name: result.service,
          status: result.status,
          responseTime: result.responseTime
        }))
      });

      return response;
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      
      const totalTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.AWS_LAMBDA_FUNCTION_VERSION || '1.0.0',
        error: (error as Error).message,
        totalTime
      };
    }
  }

  /**
   * Check database (DynamoDB) health
   */
  public async checkDatabaseHealth(): Promise<{
    service: string;
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    this.logger.debug('Checking database health via repository');
    
    try {
      const result = await this.healthRepository.checkDynamoDbHealth();
      return {
        service: result.service,
        status: result.status === 'degraded' ? 'unhealthy' : result.status,
        responseTime: result.responseTime,
        ...(result.error && { error: result.error })
      };
    } catch (error) {
      this.logger.error('Database health check failed', error as Error);
      return {
        service: 'dynamodb',
        status: 'unhealthy',
        responseTime: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Check storage (S3) health
   */
  public async checkStorageHealth(): Promise<{
    service: string;
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
  }> {
    this.logger.debug('Checking storage health via repository');
    
    try {
      const result = await this.healthRepository.checkS3Health();
      return {
        service: result.service,
        status: result.status === 'degraded' ? 'unhealthy' : result.status,
        responseTime: result.responseTime,
        ...(result.error && { error: result.error })
      };
    } catch (error) {
      this.logger.error('Storage health check failed', error as Error);
      return {
        service: 's3',
        status: 'unhealthy',
        responseTime: 0,
        error: (error as Error).message
      };
    }
  }
}