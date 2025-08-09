import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';

/**
 * Health Handler V2 - Demonstrates withoutAuth pattern
 * 
 * This handler shows how to create public endpoints that don't require authentication
 * but still benefit from the common error handling, CORS, and logging infrastructure.
 */
class HealthHandler extends BaseHandler {
  constructor() {
    super('HealthHandler');
  }

  /**
   * Health check endpoint - returns system status
   */
  public async checkHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Health check requested');

    // Collect system information
    const healthData = {
      status: 'healthy',
      version: this.version,
      stage: process.env.STAGE || 'unknown',
      timestamp: new Date().toISOString(),
      environment: {
        region: process.env.AWS_REGION || 'unknown',
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
        memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown',
        logLevel: process.env.LOG_LEVEL || 'INFO'
      },
      dependencies: {
        dynamodb: {
          usersTable: process.env.USERS_TABLE || 'not-configured',
          sessionsTable: process.env.SESSIONS_TABLE || 'not-configured',
          goalsTable: process.env.GOALS_TABLE || 'not-configured',
          analyticsTable: process.env.ANALYTICS_TABLE || 'not-configured'
        },
        s3: {
          dataBucket: process.env.DATA_BUCKET || 'not-configured'
        }
      }
    };

    // In a real implementation, you might add actual dependency checks:
    // - Test DynamoDB connectivity
    // - Test S3 bucket access
    // - Check external service availability

    return this.success(healthData, 'Health check completed successfully');
  }
}

// Export the handler using withoutAuth since no authentication is required
const healthHandler = new HealthHandler();
export const handler = healthHandler.withoutAuth(
  (event: APIGatewayProxyEvent) => healthHandler.checkHealth(event)
);