import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
export type AuthenticatedHandler = (event: APIGatewayProxyEvent, userId: string) => Promise<APIGatewayProxyResult>;
export type PublicHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
/**
 * Middleware that adds authentication to Lambda handlers
 * Extracts userId from API Gateway authorizer context
 * Provides consistent error handling and CORS support
 */
export declare const withAuth: (handler: AuthenticatedHandler) => PublicHandler;
/**
 * Wrapper for handlers that don't require authentication
 * Still provides consistent error handling and CORS
 */
export declare const withoutAuth: (handler: PublicHandler) => PublicHandler;
/**
 * Utility to extract and validate common request parameters
 */
export declare const extractRequestInfo: (event: APIGatewayProxyEvent) => {
    httpMethod: string;
    resource: string;
    pathParameters: import("aws-lambda").APIGatewayProxyEventPathParameters;
    queryStringParameters: import("aws-lambda").APIGatewayProxyEventQueryStringParameters;
    body: any;
    route: string;
};
//# sourceMappingURL=auth-middleware.d.ts.map