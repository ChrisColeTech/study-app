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
  metadata?: Record<string, any>;
}

export interface ApiErrorResponse {
  success: false;
  message?: string;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
  timestamp: string;
  requestId?: string | undefined;
}

// ===================================
// ENHANCED RESPONSE FORMATTING TYPES
// ===================================

export interface ResponseMetadata {
  pagination?: PaginationInfo | StandardizedPagination;
  performance?: ResponsePerformanceMetrics | StandardizedResponsePerformance;
  resource?: ResourceInfo | StandardizedResource;
  cache?: CacheInfo | StandardizedCache;
  contentRange?: ContentRange | StandardizedContentRange;
  count?: number;
  [key: string]: any;
}

export interface PaginationInfo {
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextPage?: number | null;
  previousPage?: number | null;
}

export interface StandardizedPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
}

export interface ResponsePerformanceMetrics {
  executionTime?: number;
  memoryUsed?: number;
  stages?: string[];
  dbQueries?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

export interface StandardizedResponsePerformance {
  executionTime: number;
  memoryUsed: number;
  stages: string[];
  dbQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface ResourceInfo {
  id: string;
  type: string;
  version?: string;
  lastModified?: string;
  etag?: string;
  links?: Record<string, string>;
}

export interface StandardizedResource {
  id: string;
  type: string;
  version: string;
  lastModified: string;
  etag?: string | undefined;
  links: StandardizedResourceLinks;
}

export interface StandardizedResourceLinks {
  [rel: string]: {
    href: string;
    rel: string;
    method: string;
  };
}

export interface CacheInfo {
  cached?: boolean;
  cacheKey?: string;
  ttl?: number;
  hitRate?: number;
  lastUpdated?: string;
  source?: string;
}

export interface StandardizedCache {
  cached: boolean;
  cacheKey?: string | undefined;
  ttl: number;
  hitRate: number;
  lastUpdated: string;
  source: string;
}

export interface ContentRange {
  unit?: string;
  start?: number;
  end?: number;
  total?: number;
}

export interface StandardizedContentRange {
  unit: string;
  start: number;
  end: number;
  total: number;
  range: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  value?: any;
  location?: string;
  constraint?: string;
}

export interface StandardizedValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
  location: string;
  constraint?: string | undefined;
}

export interface StandardizedErrorDetails {
  statusCode: number;
  timestamp: string;
  validationErrors?: StandardizedValidationError[];
  field?: string;
  value?: any;
  expected?: any;
  actual?: any;
  [key: string]: any;
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
  userRole?: string;
  isAuthenticated: boolean;
  parsedData?: {
    query?: Record<string, any>;
    path?: Record<string, any>;
    body?: any;
  };
  validationResults?: {
    query?: boolean;
    path?: boolean;
    body?: boolean;
  };
  middlewareCache?: Map<string, any>;
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
