import { APIGatewayProxyResult } from 'aws-lambda';
export declare class ResponseBuilder {
    static success<T>(data: T, statusCode?: number): APIGatewayProxyResult;
    static error(message: string, statusCode?: number): APIGatewayProxyResult;
    static validation(message: string): APIGatewayProxyResult;
    static unauthorized(message?: string): APIGatewayProxyResult;
    static forbidden(message?: string): APIGatewayProxyResult;
    static notFound(message?: string): APIGatewayProxyResult;
}
//# sourceMappingURL=response-builder.d.ts.map