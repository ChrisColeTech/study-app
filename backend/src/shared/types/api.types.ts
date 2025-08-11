import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Base API Types
export interface BaseApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string | undefined;
  timestamp: string;
  requestId?: string | undefined;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
  timestamp: string;
  requestId?: string | undefined;
}

export type ErrorDetails = unknown;

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Handler Types
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export interface HandlerContext {
  event: APIGatewayProxyEvent;
  context: Context;
  requestId: string;
  userId?: string;
  isAuthenticated: boolean;
}

// HTTP Method Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

// Route Handler Type
export type RouteHandler = (context: HandlerContext) => Promise<ApiResponse>;

// Validation Types
export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Query Parameters
export interface QueryParameters {
  [key: string]: string | string[] | undefined;
}

// Path Parameters
export interface PathParameters {
  [key: string]: string | undefined;
}