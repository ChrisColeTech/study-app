// Health monitoring handler for Study App V3

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';

export class HealthHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'HealthHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // Basic health check endpoint
      {
        method: 'GET',
        path: '/v1/health',
        handler: this.healthCheck.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Detailed system status endpoint
      {
        method: 'GET',
        path: '/v1/health/status',
        handler: this.systemStatus.bind(this),
        requireAuth: false, // Public endpoint
      },
    ];
  }

  /**
   * Basic health check endpoint
   * Returns simple health status
   */
  private async healthCheck(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Health check requested', { 
        requestId: context.requestId,
        userAgent: context.event.headers['User-Agent'],
      });

      const healthService = this.serviceFactory.getHealthService();
      const result = await healthService.checkHealth();

      return this.success(result, 'Health check completed');
    } catch (error) {
      this.logger.error('Health check failed', error, { 
        requestId: context.requestId 
      });
      
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Health check failed',
        error
      );
    }
  }

  /**
   * Detailed system status endpoint
   * Returns comprehensive system information
   */
  private async systemStatus(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('System status requested', { 
        requestId: context.requestId,
        userAgent: context.event.headers['User-Agent'],
      });

      const healthService = this.serviceFactory.getHealthService();
      const config = this.serviceFactory.getConfig();
      
      // Get basic health info
      const healthData = await healthService.checkHealth();

      // Add additional system information
      const systemInfo = {
        ...healthData,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024),
          },
        },
        configuration: {
          region: config.region,
          environment: config.environment,
          tables: {
            users: !!config.tables.users,
            studySessions: !!config.tables.studySessions,
            userProgress: !!config.tables.userProgress,
            goals: !!config.tables.goals,
          },
          buckets: {
            questionData: !!config.buckets.questionData,
            assets: !!config.buckets.assets,
          },
        },
        lambda: {
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
          functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
          runtime: process.env.AWS_EXECUTION_ENV,
          memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
          timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT,
          logGroup: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
          logStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
        },
      };

      return this.success(systemInfo, 'System status retrieved');
    } catch (error) {
      this.logger.error('System status check failed', error, { 
        requestId: context.requestId 
      });
      
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'System status check failed',
        error
      );
    }
  }
}

// Export handler function for Lambda
const healthHandler = new HealthHandler();
export const handler = healthHandler.handle;