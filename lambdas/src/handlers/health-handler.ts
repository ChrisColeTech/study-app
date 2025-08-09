import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ResponseBuilder } from '../shared/response-builder';
import AWSClients from '../shared/aws-clients';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource } = event;

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
    }

    switch (`${httpMethod} ${resource}`) {
      case 'GET /api/v1/health':
        return await handleBasicHealth(event);
      
      case 'GET /api/v1/health/detailed':
        return await handleDetailedHealth(event);
      
      default:
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Health handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleBasicHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.STAGE || 'unknown',
    };

    return ResponseBuilder.success(health);
  } catch (error) {
    return ResponseBuilder.error('Health check failed', 503);
  }
}

async function handleDetailedHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const checks = {
    overall: 'healthy' as 'healthy' | 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.STAGE || 'unknown',
    services: {
      dynamodb: { status: 'unknown' as 'healthy' | 'unhealthy' | 'unknown', responseTime: 0 },
      s3: { status: 'unknown' as 'healthy' | 'unhealthy' | 'unknown', responseTime: 0 },
      secrets: { status: 'unknown' as 'healthy' | 'unhealthy' | 'unknown', responseTime: 0 },
    },
    system: {
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
      },
      uptime: process.uptime(),
    },
  };

  // Test DynamoDB connection
  try {
    const startTime = Date.now();
    const dynamoClient = AWSClients.getDynamoClient();
    
    // Try to describe the table (lightweight operation)
    await dynamoClient.send({
      name: 'DescribeTableCommand',
      input: { TableName: process.env.MAIN_TABLE_NAME },
    } as any);
    
    checks.services.dynamodb.status = 'healthy';
    checks.services.dynamodb.responseTime = Date.now() - startTime;
  } catch (error) {
    console.error('DynamoDB health check failed:', error);
    checks.services.dynamodb.status = 'unhealthy';
    checks.overall = 'unhealthy';
  }

  // Test S3 connection
  try {
    const startTime = Date.now();
    const s3Client = AWSClients.getS3Client();
    
    // Try to list objects (lightweight operation)
    await s3Client.send({
      name: 'ListObjectsV2Command',
      input: { 
        Bucket: process.env.DATA_BUCKET_NAME,
        MaxKeys: 1,
      },
    } as any);
    
    checks.services.s3.status = 'healthy';
    checks.services.s3.responseTime = Date.now() - startTime;
  } catch (error) {
    console.error('S3 health check failed:', error);
    checks.services.s3.status = 'unhealthy';
    checks.overall = 'unhealthy';
  }

  // Test Secrets Manager connection
  try {
    const startTime = Date.now();
    const secretsClient = AWSClients.getSecretsClient();
    
    await secretsClient.send(new GetSecretValueCommand({
      SecretId: process.env.JWT_SECRET_NAME,
    }));
    
    checks.services.secrets.status = 'healthy';
    checks.services.secrets.responseTime = Date.now() - startTime;
  } catch (error) {
    console.error('Secrets Manager health check failed:', error);
    checks.services.secrets.status = 'unhealthy';
    checks.overall = 'unhealthy';
  }

  // Return appropriate status code
  const statusCode = checks.overall === 'healthy' ? 200 : 503;
  
  return ResponseBuilder.success(checks, statusCode);
}