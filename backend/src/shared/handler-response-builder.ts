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
   * Delegates to ApiResponseFormatter
   */
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return ApiResponseFormatter.createSuccessApiResponse(data, message);
  }

  /**
   * Helper method to create error responses
   * Delegates to ApiResponseFormatter
   */
  static error(code: string, message: string, details?: ErrorDetails): ApiResponse {
    return ApiResponseFormatter.createErrorApiResponse(code, message, details);
  }

  /**
   * Build standardized success response with comprehensive metadata support
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildSuccessResponse<T>(
    message: string,
    data: T,
    metadata?: ResponseMetadata
  ): ApiResponse<T> {
    const response = ApiResponseFormatter.createSuccessApiResponse(data, message);

    if (metadata) {
      return ApiResponseFormatter.addMetadataToResponse(response, MetadataStandardizer.standardizeMetadata(metadata));
    }

    return response;
  }

  /**
   * Build standardized error response with enhanced error details
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildErrorResponse(
    message: string,
    statusCode: number,
    errorCode: string,
    details?: any
  ): ApiResponse {
    const standardizedDetails = MetadataStandardizer.standardizeErrorDetails(details, statusCode);
    return ApiResponseFormatter.createErrorApiResponse(errorCode, message, standardizedDetails);
  }

  /**
   * Build paginated response with standardized pagination metadata
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildPaginatedResponse<T>(
    message: string,
    data: T[],
    pagination: PaginationInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T[]> {
    const paginationMetadata = MetadataStandardizer.standardizePaginationMetadata(pagination);
    
    const metadata: ResponseMetadata = {
      pagination: paginationMetadata,
      count: data.length,
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with performance metrics
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildPerformanceResponse<T>(
    message: string,
    data: T,
    performanceData: ResponsePerformanceMetrics,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      performance: MetadataStandardizer.standardizePerformanceMetadata(performanceData),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with validation errors
   * Delegates to ValidationErrorFormatter
   */
  static buildValidationErrorResponse(
    validationErrors: ValidationError[],
    statusCode: number = 400
  ): ApiResponse {
    return ValidationErrorFormatter.formatValidationErrors(validationErrors, statusCode);
  }

  /**
   * Build response with resource information
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildResourceResponse<T>(
    message: string,
    data: T,
    resourceInfo: ResourceInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      resource: MetadataStandardizer.standardizeResourceInfo(resourceInfo),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build partial content response (206)
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildPartialContentResponse<T>(
    message: string,
    data: T,
    contentRange: ContentRange,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      contentRange: MetadataStandardizer.standardizeContentRange(contentRange),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with caching information
   * Delegates to ApiResponseFormatter and MetadataStandardizer
   */
  static buildCachedResponse<T>(
    message: string,
    data: T,
    cacheInfo: CacheInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      cache: MetadataStandardizer.standardizeCacheInfo(cacheInfo),
      ...additionalMetadata,
    };

    return ResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  // ===================================
  // METADATA STANDARDIZATION METHODS (DELEGATES)
  // ===================================

  /**
   * Standardize general response metadata
   * Delegates to MetadataStandardizer
   */
  static standardizeMetadata(metadata: ResponseMetadata): ResponseMetadata {
    return MetadataStandardizer.standardizeMetadata(metadata);
  }

  /**
   * Standardize pagination metadata
   * Delegates to MetadataStandardizer
   */
  static standardizePaginationMetadata(pagination: PaginationInfo): StandardizedPagination {
    return MetadataStandardizer.standardizePaginationMetadata(pagination);
  }

  /**
   * Standardize performance metadata
   * Delegates to MetadataStandardizer
   */
  static standardizePerformanceMetadata(performance: ResponsePerformanceMetrics): StandardizedResponsePerformance {
    return MetadataStandardizer.standardizePerformanceMetadata(performance);
  }

  /**
   * Standardize resource information
   * Delegates to MetadataStandardizer
   */
  static standardizeResourceInfo(resource: ResourceInfo): StandardizedResource {
    return MetadataStandardizer.standardizeResourceInfo(resource);
  }

  /**
   * Standardize resource links
   * Delegates to MetadataStandardizer
   */
  static standardizeResourceLinks(links: Record<string, string>): StandardizedResourceLinks {
    return MetadataStandardizer.standardizeResourceLinks(links);
  }

  /**
   * Get default HTTP method for relation type
   * Delegates to MetadataStandardizer
   */
  static getDefaultMethodForRel(rel: string): string {
    return MetadataStandardizer.getDefaultMethodForRel(rel);
  }

  /**
   * Standardize cache information
   * Delegates to MetadataStandardizer
   */
  static standardizeCacheInfo(cache: CacheInfo): StandardizedCache {
    return MetadataStandardizer.standardizeCacheInfo(cache);
  }

  /**
   * Standardize content range information
   * Delegates to MetadataStandardizer
   */
  static standardizeContentRange(contentRange: ContentRange): StandardizedContentRange {
    return MetadataStandardizer.standardizeContentRange(contentRange);
  }

  /**
   * Standardize error details
   * Delegates to MetadataStandardizer
   */
  static standardizeErrorDetails(details: any, statusCode: number): StandardizedErrorDetails {
    return MetadataStandardizer.standardizeErrorDetails(details, statusCode);
  }

  /**
   * Standardize validation errors
   * Delegates to ValidationErrorFormatter
   */
  static standardizeValidationErrors(errors: ValidationError[]): StandardizedValidationError[] {
    return ValidationErrorFormatter.standardizeValidationErrors(errors);
  }
}

// ===================================
// HELPER CLASSES FOR HANDLER RESPONSE BUILDER OPTIMIZATION  
// ===================================

/**
 * ApiResponseFormatter - API response structure formatting
 * Handles core API response construction and basic formatting
 */
export class ApiResponseFormatter {
  /**
   * Create basic success API response
   */
  static createSuccessApiResponse<T>(
    data: T,
    message?: string,
    timestamp?: string
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: timestamp || new Date().toISOString(),
    };
  }

  /**
   * Create basic error API response
   */
  static createErrorApiResponse(
    code: string,
    message: string,
    details?: ErrorDetails,
    timestamp?: string
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: timestamp || new Date().toISOString(),
    };
  }

  /**
   * Add metadata to existing response
   */
  /**
   * Add metadata to existing response (only for success responses)
   */
  static addMetadataToResponse<T>(
    response: ApiResponse<T>,
    metadata: ResponseMetadata
  ): ApiResponse<T> {
    if (response.success) {
      return {
        ...response,
        metadata,
      };
    }
    // Return error responses unchanged as they don't support metadata
    return response;
  }

  /**
   * Create success response with automatic timestamp
   */
  static buildSuccessResponse<T>(
    message: string,
    data: T
  ): ApiResponse<T> {
    return ApiResponseFormatter.createSuccessApiResponse(data, message);
  }

  /**
   * Create error response with automatic timestamp  
   */
  static buildErrorResponse(
    message: string,
    statusCode: number,
    errorCode: string
  ): ApiResponse {
    return ApiResponseFormatter.createErrorApiResponse(errorCode, message);
  }
}

/**
 * MetadataStandardizer - All metadata standardization functionality
 * Handles pagination, performance, resource, cache, and content range metadata
 */
export class MetadataStandardizer {
  /**
   * Standardize general response metadata
   */
  static standardizeMetadata(metadata: ResponseMetadata): ResponseMetadata {
    const standardized: ResponseMetadata = {};

    if (metadata.pagination) {
      standardized.pagination = MetadataStandardizer.standardizePaginationMetadata(metadata.pagination);
    }

    if (metadata.performance && 'executionTime' in metadata.performance) {
      standardized.performance = MetadataStandardizer.standardizePerformanceMetadata(metadata.performance as ResponsePerformanceMetrics);
    }

    if (metadata.resource && 'id' in metadata.resource) {
      standardized.resource = MetadataStandardizer.standardizeResourceInfo(metadata.resource as ResourceInfo);
    }

    if (metadata.cache && 'cached' in metadata.cache) {
      standardized.cache = MetadataStandardizer.standardizeCacheInfo(metadata.cache as CacheInfo);
    }

    if (metadata.contentRange && 'unit' in metadata.contentRange) {
      standardized.contentRange = MetadataStandardizer.standardizeContentRange(metadata.contentRange as ContentRange);
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
      links: MetadataStandardizer.standardizeResourceLinks(resource.links || {}),
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
        method: MetadataStandardizer.getDefaultMethodForRel(rel),
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
      standardized.validationErrors = MetadataStandardizer.standardizeValidationErrors(details.validationErrors);
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

/**
 * ValidationErrorFormatter - Validation error formatting and standardization  
 * Handles validation error processing and formatting
 */
export class ValidationErrorFormatter {
  /**
   * Format validation errors into standardized response
   */
  static formatValidationErrors(
    validationErrors: ValidationError[],
    statusCode: number = 400
  ): ApiResponse {
    const formattedErrors = ValidationErrorFormatter.standardizeValidationErrors(validationErrors);
    
    return ApiResponseFormatter.createErrorApiResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      {
        validationErrors: formattedErrors,
        errorCount: formattedErrors.length,
        statusCode,
      }
    );
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

  /**
   * Create validation error response with detailed context
   */
  static createDetailedValidationErrorResponse(
    errors: ValidationError[],
    statusCode: number = 400,
    customMessage?: string
  ): ApiResponse {
    const formattedErrors = ValidationErrorFormatter.standardizeValidationErrors(errors);
    const errorCount = formattedErrors.length;
    
    const message = customMessage || 
      (errorCount === 1 ? 'A validation error occurred' : `${errorCount} validation errors occurred`);

    return ApiResponseFormatter.createErrorApiResponse(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      {
        validationErrors: formattedErrors,
        errorCount,
        statusCode,
        severity: errorCount > 5 ? 'high' : errorCount > 2 ? 'medium' : 'low',
      }
    );
  }

  /**
   * Extract validation error summary
   */
  static extractValidationSummary(errors: ValidationError[]): {
    fieldCount: number;
    errorCount: number;
    fields: string[];
    mostCommonError: string;
  } {
    const fields = Array.from(new Set(errors.map(e => e.field)));
    const errorMessages = errors.map(e => e.message);
    const messageCount = errorMessages.reduce((acc, msg) => {
      acc[msg] = (acc[msg] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonError = Object.keys(messageCount).reduce((a, b) => 
      messageCount[a] > messageCount[b] ? a : b
    );

    return {
      fieldCount: fields.length,
      errorCount: errors.length,
      fields,
      mostCommonError,
    };
  }
}
