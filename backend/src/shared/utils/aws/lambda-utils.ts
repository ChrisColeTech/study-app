/**
 * Lambda utility functions
 * 
 * Single Responsibility: Lambda execution context and environment utilities
 */

import { ConfigurationManager } from '@/shared/service-factory';

/**
 * Extract request ID from Lambda context
 */
export function getRequestId(context?: any): string | undefined {
  return context?.awsRequestId;
}

/**
 * Get remaining execution time in milliseconds
 */
export function getRemainingTime(context?: any): number {
  if (!context?.getRemainingTimeInMillis) return 0;
  return context.getRemainingTimeInMillis();
}

/**
 * Check if Lambda function is about to timeout
 */
export function isNearTimeout(context?: any, bufferMs = 5000): boolean {
  const remaining = getRemainingTime(context);
  return remaining > 0 && remaining <= bufferMs;
}

/**
 * Get Lambda function name
 */
export function getFunctionName(context?: any): string | undefined {
  return context?.functionName;
}

/**
 * Get Lambda function version
 */
export function getFunctionVersion(context?: any): string | undefined {
  return context?.functionVersion;
}

/**
 * Get Lambda memory limit in MB
 */
export function getMemoryLimit(context?: any): number | undefined {
  const memoryLimitInMB = context?.memoryLimitInMB;
  return memoryLimitInMB ? parseInt(memoryLimitInMB, 10) : undefined;
}

/**
 * Get invoked function ARN
 */
export function getInvokedFunctionArn(context?: any): string | undefined {
  return context?.invokedFunctionArn;
}

/**
 * Extract region from ARN or environment
 */
export function getCurrentRegion(): string {
  return ConfigurationManager.getInstance().getAWSConfig().region;
}

/**
 * Extract account ID from context or ARN
 */
export function getAccountId(context?: any): string | undefined {
  const arn = getInvokedFunctionArn(context);
  if (arn) {
    const parts = arn.split(':');
    return parts.length >= 5 ? parts[4] : undefined;
  }
  
  return process.env.AWS_ACCOUNT_ID;
}

/**
 * Check if running in Lambda environment
 */
export function isLambdaEnvironment(): boolean {
  return !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_RUNTIME_DIR);
}

/**
 * Get Lambda runtime information
 */
export function getLambdaRuntime(): {
  functionName?: string;
  version?: string;
  memoryLimit?: number;
  region: string;
  accountId?: string;
  requestId?: string;
  isLambda: boolean;
} {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  const version = process.env.AWS_LAMBDA_FUNCTION_VERSION;
  const memoryLimitStr = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;
  const accountId = process.env.AWS_ACCOUNT_ID;
  const requestId = process.env.AWS_REQUEST_ID;
  
  const result: any = {
    region: getCurrentRegion(),
    isLambda: isLambdaEnvironment(),
  };
  
  if (functionName !== undefined) result.functionName = functionName;
  if (version !== undefined) result.version = version;
  if (memoryLimitStr !== undefined) result.memoryLimit = parseInt(memoryLimitStr, 10);
  if (accountId !== undefined) result.accountId = accountId;
  if (requestId !== undefined) result.requestId = requestId;
  
  return result;
}

/**
 * Create Lambda execution context for logging
 */
export function createExecutionContext(context?: any): Record<string, any> {
  return {
    requestId: getRequestId(context),
    functionName: getFunctionName(context),
    functionVersion: getFunctionVersion(context),
    memoryLimit: getMemoryLimit(context),
    remainingTime: getRemainingTime(context),
    region: getCurrentRegion(),
    accountId: getAccountId(context),
  };
}

/**
 * Format Lambda response for API Gateway
 */
export function formatApiGatewayResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {},
  isBase64Encoded = false
): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT,DELETE',
      'Access-Control-Allow-Headers': 'Origin,X-Requested-With,Content-Type,Accept,Authorization',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded,
  };
}

/**
 * Parse API Gateway event
 */
export function parseApiGatewayEvent(event: any): {
  httpMethod: string;
  path: string;
  queryParameters: Record<string, string>;
  pathParameters: Record<string, string>;
  headers: Record<string, string>;
  body: any;
  isBase64Encoded: boolean;
  requestContext: any;
} {
  const queryParams = event.queryStringParameters || {};
  const pathParams = event.pathParameters || {};
  const headers = event.headers || {};
  
  let body = event.body;
  if (body && typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // Keep as string if not valid JSON
    }
  }
  
  return {
    httpMethod: event.httpMethod || event.requestContext?.http?.method || 'GET',
    path: event.path || event.requestContext?.http?.path || '/',
    queryParameters: queryParams,
    pathParameters: pathParams,
    headers,
    body,
    isBase64Encoded: event.isBase64Encoded || false,
    requestContext: event.requestContext || {},
  };
}

/**
 * Check if event is from API Gateway
 */
export function isApiGatewayEvent(event: any): boolean {
  return !!(event.httpMethod || event.requestContext?.http?.method);
}

/**
 * Check if event is from scheduled CloudWatch event
 */
export function isScheduledEvent(event: any): boolean {
  return event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event';
}

/**
 * Check if event is from S3
 */
export function isS3Event(event: any): boolean {
  return !!(event.Records && Array.isArray(event.Records) && 
           event.Records[0]?.eventSource === 'aws:s3');
}

/**
 * Check if event is from DynamoDB Streams
 */
export function isDynamoDBEvent(event: any): boolean {
  return !!(event.Records && Array.isArray(event.Records) && 
           event.Records[0]?.eventSource === 'aws:dynamodb');
}

/**
 * Get cold start information
 */
export function getColdStartInfo(): {
  isColdStart: boolean;
  initDuration?: number;
} {
  // This is a simple heuristic - in real Lambda, you'd track this globally
  const initTime = process.env.LAMBDA_INIT_TIME;
  const isColdStart = !initTime;
  
  if (isColdStart) {
    process.env.LAMBDA_INIT_TIME = Date.now().toString();
  }
  
  const result: any = {
    isColdStart,
  };
  
  if (initTime) {
    result.initDuration = Date.now() - parseInt(initTime, 10);
  }
  
  return result;
}

/**
 * Create timeout handler
 */
export function createTimeoutHandler(context?: any, bufferMs = 5000): () => boolean {
  const startTime = Date.now();
  
  return () => {
    const elapsed = Date.now() - startTime;
    const remaining = getRemainingTime(context);
    
    // If context is available, use it; otherwise estimate based on typical Lambda timeouts
    if (remaining > 0) {
      return remaining <= bufferMs;
    }
    
    // Fallback: assume 15 minutes max execution time
    const assumedTimeout = 15 * 60 * 1000;
    return (elapsed + bufferMs) >= assumedTimeout;
  };
}

/**
 * Measure Lambda performance
 */
export function measurePerformance<T>(
  operation: () => Promise<T> | T,
  name: string
): Promise<{ result: T; duration: number; memoryUsed?: number }> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  const executeOperation = async () => {
    const result = await operation();
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    return {
      result,
      duration: endTime - startTime,
      memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
    };
  };
  
  return executeOperation();
}

/**
 * Create Lambda error response
 */
export function createLambdaErrorResponse(
  error: Error,
  statusCode = 500,
  includeStack = false
): any {
  const response = {
    error: {
      name: error.name,
      message: error.message,
      ...(includeStack && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
  };
  
  return formatApiGatewayResponse(statusCode, response);
}