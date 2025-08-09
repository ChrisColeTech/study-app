import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse } from '../types';

export class ResponseBuilder {
  static success<T>(data: T, statusCode: number = 200): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify({
        success: true,
        data,
      } as ApiResponse<T>),
    };
  }

  static error(message: string, statusCode: number = 500): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify({
        success: false,
        error: message,
      } as ApiResponse),
    };
  }

  static validation(message: string): APIGatewayProxyResult {
    return this.error(message, 400);
  }

  static unauthorized(message: string = 'Unauthorized'): APIGatewayProxyResult {
    return this.error(message, 401);
  }

  static forbidden(message: string = 'Forbidden'): APIGatewayProxyResult {
    return this.error(message, 403);
  }

  static notFound(message: string = 'Not Found'): APIGatewayProxyResult {
    return this.error(message, 404);
  }
}