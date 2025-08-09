"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRequestInfo = exports.withoutAuth = exports.withAuth = void 0;
const response_builder_1 = require("./response-builder");
/**
 * Middleware that adds authentication to Lambda handlers
 * Extracts userId from API Gateway authorizer context
 * Provides consistent error handling and CORS support
 */
const withAuth = (handler) => {
    return async (event) => {
        try {
            console.log(`[AUTH] ${event.httpMethod} ${event.resource} - Processing request`);
            // Handle CORS preflight
            if (event.httpMethod === 'OPTIONS') {
                return response_builder_1.ResponseBuilder.success('', 200);
            }
            // Extract userId from authorizer context
            const userId = event.requestContext.authorizer?.userId;
            if (!userId) {
                console.log('[AUTH] No userId found in authorizer context');
                console.log('[AUTH] Authorizer context:', JSON.stringify(event.requestContext.authorizer, null, 2));
                return response_builder_1.ResponseBuilder.unauthorized('User not authenticated');
            }
            console.log(`[AUTH] Authenticated user: ${userId}`);
            // Call the actual handler with userId
            return await handler(event, userId);
        }
        catch (error) {
            console.error('[AUTH] Authentication middleware error:', error);
            return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Authentication failed');
        }
    };
};
exports.withAuth = withAuth;
/**
 * Wrapper for handlers that don't require authentication
 * Still provides consistent error handling and CORS
 */
const withoutAuth = (handler) => {
    return async (event) => {
        try {
            console.log(`[PUBLIC] ${event.httpMethod} ${event.resource} - Processing public request`);
            // Handle CORS preflight
            if (event.httpMethod === 'OPTIONS') {
                return response_builder_1.ResponseBuilder.success('', 200);
            }
            return await handler(event);
        }
        catch (error) {
            console.error('[PUBLIC] Public handler error:', error);
            return response_builder_1.ResponseBuilder.error(error instanceof Error ? error.message : 'Internal server error');
        }
    };
};
exports.withoutAuth = withoutAuth;
/**
 * Utility to extract and validate common request parameters
 */
const extractRequestInfo = (event) => {
    return {
        httpMethod: event.httpMethod,
        resource: event.resource,
        pathParameters: event.pathParameters || {},
        queryStringParameters: event.queryStringParameters || {},
        body: event.body ? JSON.parse(event.body) : null,
        route: `${event.httpMethod} ${event.resource}`
    };
};
exports.extractRequestInfo = extractRequestInfo;
//# sourceMappingURL=auth-middleware.js.map