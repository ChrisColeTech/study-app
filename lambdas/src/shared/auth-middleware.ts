import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ResponseBuilder } from './response-builder';

// Type definition for authenticated handlers
export type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  userId: string
) => Promise<APIGatewayProxyResult>;

// Type definition for handlers that don't need auth
export type PublicHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Middleware that adds authentication to Lambda handlers
 * Extracts userId from API Gateway authorizer context
 * Provides consistent error handling and CORS support
 */
export const withAuth = (handler: AuthenticatedHandler): PublicHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      console.log(`[AUTH] ${event.httpMethod} ${event.resource} - Processing request`);
      
      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return ResponseBuilder.success('', 200);
      }

      // Extract userId from authorizer context
      const userId = event.requestContext.authorizer?.userId;
      
      if (!userId) {
        console.log('[AUTH] No userId found in authorizer context');
        console.log('[AUTH] Authorizer context:', JSON.stringify(event.requestContext.authorizer, null, 2));
        return ResponseBuilder.unauthorized('User not authenticated');
      }

      console.log(`[AUTH] Authenticated user: ${userId}`);
      
      // Call the actual handler with userId
      return await handler(event, userId);
      
    } catch (error) {
      console.error('[AUTH] Authentication middleware error:', error);
      return ResponseBuilder.error(
        error instanceof Error ? error.message : 'Authentication failed'
      );
    }
  };
};

/**
 * Wrapper for handlers that don't require authentication
 * Still provides consistent error handling and CORS
 */
export const withoutAuth = (handler: PublicHandler): PublicHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      console.log(`[PUBLIC] ${event.httpMethod} ${event.resource} - Processing public request`);
      
      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return ResponseBuilder.success('', 200);
      }

      return await handler(event);
      
    } catch (error) {
      console.error('[PUBLIC] Public handler error:', error);
      return ResponseBuilder.error(
        error instanceof Error ? error.message : 'Internal server error'
      );
    }
  };
};

/**
 * Utility to extract and validate common request parameters
 */
export const extractRequestInfo = (event: APIGatewayProxyEvent) => {
  return {
    httpMethod: event.httpMethod,
    resource: event.resource,
    pathParameters: event.pathParameters || {},
    queryStringParameters: event.queryStringParameters || {},
    body: event.body ? JSON.parse(event.body) : null,
    route: `${event.httpMethod} ${event.resource}`
  };
};