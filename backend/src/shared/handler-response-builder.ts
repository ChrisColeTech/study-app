/**
 * ResponseBuilder - Specialized response formatting for BaseHandler
 * Extracted from BaseHandler to achieve SRP compliance
 */

import { 
  ApiResponse, 
  ErrorDetails, 
  ResponseMetadata,
  PaginationInfo,
  ResponsePerformanceMetrics,
  ResourceInfo,
  ContentRange,
  CacheInfo,
  ValidationError,
  StandardizedPagination,
  StandardizedResponsePerformance,
  StandardizedResource,
  StandardizedResourceLinks,
  StandardizedCache,
  StandardizedContentRange,
  StandardizedErrorDetails,
  StandardizedValidationError
} from './types/api.types';
import { ERROR_CODES } from './constants/error.constants';

export class ResponseBuilder {
  /**
   * Helper method to create success responses
   */
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper method to create error responses
   */
  static error(code: string, message: string, details?: ErrorDetails): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build standardized success response with comprehensive metadata support
   */
  static buildSuccessResponse<T>(
    message: string,
    data: T,
    metadata?: ResponseMetadata
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    if (metadata) {
      response.metadata = ResponseBuilder.standardizeMetadata(metadata);
    }

    return response;
  }

  /**
   * Build standardized error response with enhanced error details
   */
  static buildErrorResponse(
    message: string,
    statusCode: number,
    errorCode: string,
    details?: any
  ): ApiResponse {
    return {
      success: false,
      message,
      error: {
        code: errorCode,
        message,
        details: ResponseBuilder.standardizeErrorDetails(details, statusCode),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build paginated response with standardized pagination metadata
   */
  static buildPaginatedResponse<T>(
    message: string,
    data: T[],
    pagination: PaginationInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T[]> {
    const paginationMetadata = ResponseBuilder.standardizePaginationMetadata(pagination);
    
    const metadata: ResponseMetadata = {
      pagination: paginationMetadata,
      count: data.length,
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with performance metrics
   */
  static buildPerformanceResponse<T>(
    message: string,
    data: T,
    performanceData: ResponsePerformanceMetrics,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      performance: ResponseBuilder.standardizePerformanceMetadata(performanceData),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with validation errors
   */
  static buildValidationErrorResponse(
    validationErrors: ValidationError[],
    statusCode: number = 400
  ): ApiResponse {
    const formattedErrors = ResponseBuilder.standardizeValidationErrors(validationErrors);
    
    return ResponseBuilder.buildErrorResponse(
      'Validation failed',
      statusCode,
      ERROR_CODES.VALIDATION_ERROR,
      {
        validationErrors: formattedErrors,
        errorCount: formattedErrors.length,
      }
    );
  }

  /**
   * Build response with resource information
   */
  static buildResourceResponse<T>(
    message: string,
    data: T,
    resourceInfo: ResourceInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      resource: ResponseBuilder.standardizeResourceInfo(resourceInfo),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build partial content response (206)
   */
  static buildPartialContentResponse<T>(
    message: string,
    data: T,
    contentRange: ContentRange,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      contentRange: ResponseBuilder.standardizeContentRange(contentRange),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with caching information
   */
  static buildCachedResponse<T>(
    message: string,
    data: T,
    cacheInfo: CacheInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      cache: ResponseBuilder.standardizeCacheInfo(cacheInfo),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  // ===================================
  // METADATA STANDARDIZATION METHODS
  // ===================================

  /**
   * Standardize general response metadata
   */
  static standardizeMetadata(metadata: ResponseMetadata): ResponseMetadata {
    const standardized: ResponseMetadata = {};

    if (metadata.pagination) {
      standardized.pagination = ResponseBuilder.standardizePaginationMetadata(metadata.pagination);
    }

    if (metadata.performance && 'executionTime' in metadata.performance) {
      standardized.performance = ResponseBuilder.standardizePerformanceMetadata(metadata.performance as ResponsePerformanceMetrics);
    }

    if (metadata.resource && 'id' in metadata.resource) {
      standardized.resource = ResponseBuilder.standardizeResourceInfo(metadata.resource as ResourceInfo);
    }

    if (metadata.cache && 'cached' in metadata.cache) {
      standardized.cache = ResponseBuilder.standardizeCacheInfo(metadata.cache as CacheInfo);
    }

    if (metadata.contentRange && 'unit' in metadata.contentRange) {
      standardized.contentRange = ResponseBuilder.standardizeContentRange(metadata.contentRange as ContentRange);
    }

    // Include any additional metadata
    Object.keys(metadata).forEach(key => {
      if (!['pagination', 'performance', 'resource', 'cache', 'contentRange'].includes(key)) {
        standardized[key] = metadata[key];
      }
    });

    return standardized;
  }

  /**
   * Standardize pagination metadata
   */
  static standardizePaginationMetadata(pagination: PaginationInfo): StandardizedPagination {
    return {
      currentPage: pagination.currentPage || 1,
      pageSize: pagination.pageSize || 10,
      totalItems: pagination.totalItems || 0,
      totalPages: pagination.totalPages || Math.ceil((pagination.totalItems || 0) / (pagination.pageSize || 10)),
      hasNextPage: pagination.hasNextPage ?? false,
      hasPreviousPage: pagination.hasPreviousPage ?? false,
      nextPage: pagination.hasNextPage ? (pagination.currentPage || 1) + 1 : null,
      previousPage: pagination.hasPreviousPage ? (pagination.currentPage || 1) - 1 : null,
    };
  }

  /**
   * Standardize performance metadata
   */
  static standardizePerformanceMetadata(performance: ResponsePerformanceMetrics): StandardizedResponsePerformance {
    return {
      executionTime: performance.executionTime || 0,
      memoryUsed: performance.memoryUsed || 0,
      stages: performance.stages || [],
      dbQueries: performance.dbQueries || 0,
      cacheHits: performance.cacheHits || 0,
      cacheMisses: performance.cacheMisses || 0,
    };
  }

  /**
   * Standardize resource information
   */
  static standardizeResourceInfo(resource: ResourceInfo): StandardizedResource {
    return {
      id: resource.id,
      type: resource.type,
      version: resource.version || '1.0',
      lastModified: resource.lastModified || new Date().toISOString(),
      etag: resource.etag || undefined,
      links: ResponseBuilder.standardizeResourceLinks(resource.links || {}),
    };
  }

  /**
   * Standardize resource links
   */
  static standardizeResourceLinks(links: Record<string, string>): StandardizedResourceLinks {
    const standardized: StandardizedResourceLinks = {};

    Object.keys(links).forEach(rel => {
      standardized[rel] = {
        href: links[rel],
        rel,
        method: ResponseBuilder.getDefaultMethodForRel(rel),
      };
    });

    return standardized;
  }

  /**
   * Get default HTTP method for relation type
   */
  static getDefaultMethodForRel(rel: string): string {
    const methodMap: Record<string, string> = {
      self: 'GET',
      edit: 'PUT',
      delete: 'DELETE',
      create: 'POST',
      update: 'PATCH',
      list: 'GET',
      parent: 'GET',
      next: 'GET',
      prev: 'GET',
      first: 'GET',
      last: 'GET',
    };

    return methodMap[rel] || 'GET';
  }

  /**
   * Standardize cache information
   */
  static standardizeCacheInfo(cache: CacheInfo): StandardizedCache {
    return {
      cached: cache.cached || false,
      cacheKey: cache.cacheKey || undefined,
      ttl: cache.ttl || 0,
      hitRate: cache.hitRate || 0,
      lastUpdated: cache.lastUpdated || new Date().toISOString(),
      source: cache.source || 'database',
    };
  }

  /**
   * Standardize content range information
   */
  static standardizeContentRange(contentRange: ContentRange): StandardizedContentRange {
    return {
      unit: contentRange.unit || 'items',
      start: contentRange.start || 0,
      end: contentRange.end || 0,
      total: contentRange.total || 0,
      range: `${contentRange.start || 0}-${contentRange.end || 0}/${contentRange.total || 0}`,
    };
  }

  /**
   * Standardize error details
   */
  static standardizeErrorDetails(details: any, statusCode: number): StandardizedErrorDetails {
    if (!details) {
      return {
        statusCode,
        timestamp: new Date().toISOString(),
      };
    }

    const standardized: StandardizedErrorDetails = {
      statusCode,
      timestamp: new Date().toISOString(),
    };

    if (details.validationErrors) {
      standardized.validationErrors = ResponseBuilder.standardizeValidationErrors(details.validationErrors);
    }

    if (details.field) {
      standardized.field = details.field;
    }

    if (details.value) {
      standardized.value = details.value;
    }

    if (details.expected) {
      standardized.expected = details.expected;
    }

    if (details.actual) {
      standardized.actual = details.actual;
    }

    // Include any additional details
    Object.keys(details).forEach(key => {
      if (!['validationErrors', 'field', 'value', 'expected', 'actual'].includes(key)) {
        standardized[key] = details[key];
      }
    });

    return standardized;
  }

  /**
   * Standardize validation errors
   */
  static standardizeValidationErrors(errors: ValidationError[]): StandardizedValidationError[] {
    return errors.map(error => ({
      field: error.field,
      message: error.message,
      code: error.code || 'VALIDATION_ERROR',
      value: error.value,
      location: error.location || 'body',
      constraint: error.constraint || undefined,
    }));
  }
}