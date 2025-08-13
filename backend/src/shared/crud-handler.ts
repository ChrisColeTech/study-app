// CrudHandler pattern for standard CRUD operations

import { BaseHandler, RouteConfig } from './base-handler';
import { HandlerContext, ApiResponse, PaginationParams, ValidationError } from './types/api.types';
import { ERROR_CODES } from './constants/error.constants';

export interface CrudEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrudService<T extends CrudEntity> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  getById(id: string): Promise<T | null>;
  getAll(params?: PaginationParams): Promise<{ items: T[]; total: number }>;
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;
  delete(id: string): Promise<boolean>;
  search?(query: string, params?: PaginationParams): Promise<{ items: T[]; total: number }>;
}

export interface CrudHandlerOptions {
  entityName: string;
  basePath: string;
  requireAuth?: boolean;
  permissions?: {
    create?: string[];
    read?: string[];
    update?: string[];
    delete?: string[];
  };
}

export abstract class CrudHandler<T extends CrudEntity> extends BaseHandler {
  protected abstract service: CrudService<T>;
  protected options: CrudHandlerOptions;

  constructor(options: CrudHandlerOptions) {
    super();
    this.options = options;
  }

  protected setupRoutes(): void {
    const { basePath, requireAuth = true, permissions = {} } = this.options;

    this.routes = [
      // Create entity
      {
        method: 'POST',
        path: basePath,
        handler: this.create.bind(this),
        requireAuth,
        permissions: permissions.create || undefined,
      },
      // Get all entities (with pagination and search)
      {
        method: 'GET',
        path: basePath,
        handler: this.getAll.bind(this),
        requireAuth,
        permissions: permissions.read || undefined,
      },
      // Get entity by ID
      {
        method: 'GET',
        path: `${basePath}/{id}`,
        handler: this.getById.bind(this),
        requireAuth,
        permissions: permissions.read || undefined,
      },
      // Update entity by ID
      {
        method: 'PUT',
        path: `${basePath}/{id}`,
        handler: this.update.bind(this),
        requireAuth,
        permissions: permissions.update || undefined,
      },
      // Delete entity by ID
      {
        method: 'DELETE',
        path: `${basePath}/{id}`,
        handler: this.delete.bind(this),
        requireAuth,
        permissions: permissions.delete || undefined,
      },
    ];

    // Add search route if service supports it
    if (this.service.search) {
      this.routes.push({
        method: 'GET',
        path: `${basePath}/search`,
        handler: this.search.bind(this),
        requireAuth,
        permissions: permissions.read || undefined,
      });
    }
  }

  /**
   * Create a new entity with enhanced validation and error handling
   */
  protected async create(context: HandlerContext): Promise<ApiResponse<T>> {
    const { result, error } = await this.executeServiceOrError(
      async () => {
        // Enhanced request body parsing with validation
        const { data: body, error: parseError } = await this.parseRequestBodyOrError<
          Omit<T, 'id' | 'createdAt' | 'updatedAt'>
        >(context, true);
        
        if (parseError) return parseError;

        // Validate create data with enhanced error messaging
        const validationResult = await this.validateCreateData(body!);
        if (!validationResult.isValid) {
          return this.buildErrorResponse(
            'Validation failed',
            400,
            ERROR_CODES.VALIDATION_ERROR,
            validationResult.errors
          );
        }

        // Execute service operation with performance tracking
        const entity = await this.service.create(body!);

        return this.buildSuccessResponse(
          `${this.options.entityName} created successfully`,
          entity,
          {
            operation: 'create',
            entityType: this.options.entityName,
            timestamp: new Date().toISOString(),
          }
        );
      },
      {
        requestId: context.requestId,
        operation: `create_${this.options.entityName.toLowerCase()}`,
        ...(context.userId && { userId: context.userId }),
        additionalInfo: {
          entityType: this.options.entityName,
          basePath: this.options.basePath,
        },
      }
    );

    if (error) return error;
    return result!;
  }

  /**
   * Get all entities with enhanced pagination and filtering
   */
  protected async getAll(context: HandlerContext): Promise<ApiResponse<any>> {
    const { result, error } = await this.executeServiceOrError(
      async () => {
        // Enhanced query parameter parsing with schema validation
        const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(
          context,
          {
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
            sortBy: { type: 'string' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          }
        );

        if (parseError) return parseError;

        // Build enhanced pagination parameters with validation
        const paginationParams: PaginationParams = {
          page: Math.max(1, queryParams?.page || 1),
          limit: Math.min(100, Math.max(1, queryParams?.limit || 20)), // Enforce reasonable limits
          sortBy: queryParams?.sortBy,
          sortOrder: queryParams?.sortOrder as 'asc' | 'desc',
        };

        // Validate sort order
        if (paginationParams.sortOrder && !['asc', 'desc'].includes(paginationParams.sortOrder)) {
          return this.buildErrorResponse(
            'Invalid sort order. Must be "asc" or "desc"',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        const result = await this.service.getAll(paginationParams);

        // Enhanced response with comprehensive pagination metadata
        const response = {
          items: result.items,
          pagination: {
            currentPage: paginationParams.page!,
            totalPages: Math.ceil(result.total / paginationParams.limit!),
            totalItems: result.total,
            itemsPerPage: paginationParams.limit!,
            hasNextPage: paginationParams.page! * paginationParams.limit! < result.total,
            hasPreviousPage: paginationParams.page! > 1,
            startIndex: (paginationParams.page! - 1) * paginationParams.limit! + 1,
            endIndex: Math.min(paginationParams.page! * paginationParams.limit!, result.total),
          },
          metadata: {
            entityType: this.options.entityName,
            operation: 'getAll',
            timestamp: new Date().toISOString(),
            filters: queryParams?.sortBy ? { sortBy: queryParams.sortBy, sortOrder: paginationParams.sortOrder } : undefined,
          },
        };

        return this.buildSuccessResponse(
          `Retrieved ${result.items.length} ${this.options.entityName.toLowerCase()}(s)`,
          response
        );
      },
      {
        requestId: context.requestId,
        operation: `getAll_${this.options.entityName.toLowerCase()}`,
        ...(context.userId && { userId: context.userId }),
        additionalInfo: {
          entityType: this.options.entityName,
          basePath: this.options.basePath,
        },
      }
    );

    if (error) return error;
    return result!;
  }

  /**
   * Get entity by ID with enhanced validation
   */
  protected async getById(context: HandlerContext): Promise<ApiResponse<T>> {
    const { result, error } = await this.executeServiceOrError(
      async () => {
        // Enhanced path parameter parsing with validation
        const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
        if (parseError) return parseError;

        const { id } = pathParams;

        if (!id) {
          return this.buildErrorResponse(
            'ID parameter is required',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        // Validate ID format (basic UUID validation)
        if (!this.isValidId(id)) {
          return this.buildErrorResponse(
            'Invalid ID format',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        const entity = await this.service.getById(id);

        if (!entity) {
          return this.buildErrorResponse(
            `${this.options.entityName} not found`,
            404,
            ERROR_CODES.NOT_FOUND
          );
        }

        return this.buildSuccessResponse(
          `${this.options.entityName} retrieved successfully`,
          entity,
          {
            operation: 'getById',
            entityType: this.options.entityName,
            entityId: id,
            timestamp: new Date().toISOString(),
          }
        );
      },
      {
        requestId: context.requestId,
        operation: `getById_${this.options.entityName.toLowerCase()}`,
        ...(context.userId && { userId: context.userId }),
        additionalInfo: {
          entityType: this.options.entityName,
          basePath: this.options.basePath,
        },
      }
    );

    if (error) return error;
    return result!;
  }

  /**
   * Update entity by ID with enhanced validation and conflict detection
   */
  protected async update(context: HandlerContext): Promise<ApiResponse<T>> {
    const { result, error } = await this.executeServiceOrError(
      async () => {
        // Parse and validate path parameters
        const { data: pathParams, error: pathError } = await this.parsePathParamsOrError(context);
        if (pathError) return pathError;

        // Parse and validate request body
        const { data: body, error: bodyError } = await this.parseRequestBodyOrError<
          Partial<Omit<T, 'id' | 'createdAt'>>
        >(context, true);
        if (bodyError) return bodyError;

        const { id } = pathParams;

        if (!id) {
          return this.buildErrorResponse(
            'ID parameter is required',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        if (!this.isValidId(id)) {
          return this.buildErrorResponse(
            'Invalid ID format',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        // Check if entity exists before attempting update
        const existingEntity = await this.service.getById(id);
        if (!existingEntity) {
          return this.buildErrorResponse(
            `${this.options.entityName} not found`,
            404,
            ERROR_CODES.NOT_FOUND
          );
        }

        // Validate update data
        const validationResult = await this.validateUpdateData(body!);
        if (!validationResult.isValid) {
          return this.buildErrorResponse(
            'Validation failed',
            400,
            ERROR_CODES.VALIDATION_ERROR,
            validationResult.errors
          );
        }

        const updatedEntity = await this.service.update(id, body!);

        return this.buildSuccessResponse(
          `${this.options.entityName} updated successfully`,
          updatedEntity,
          {
            operation: 'update',
            entityType: this.options.entityName,
            entityId: id,
            timestamp: new Date().toISOString(),
            fieldsUpdated: Object.keys(body!).length,
          }
        );
      },
      {
        requestId: context.requestId,
        operation: `update_${this.options.entityName.toLowerCase()}`,
        ...(context.userId && { userId: context.userId }),
        additionalInfo: {
          entityType: this.options.entityName,
          basePath: this.options.basePath,
        },
      }
    );

    if (error) return error;
    return result!;
  }

  /**
   * Delete entity by ID with enhanced validation and confirmation
   */
  protected async delete(context: HandlerContext): Promise<ApiResponse<{ deleted: boolean }>> {
    const { result, error } = await this.executeServiceOrError(
      async () => {
        // Enhanced path parameter parsing with validation
        const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
        if (parseError) return parseError;

        const { id } = pathParams;

        if (!id) {
          return this.buildErrorResponse(
            'ID parameter is required',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        if (!this.isValidId(id)) {
          return this.buildErrorResponse(
            'Invalid ID format',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        // Check if entity exists before attempting deletion
        const existingEntity = await this.service.getById(id);
        if (!existingEntity) {
          return this.buildErrorResponse(
            `${this.options.entityName} not found`,
            404,
            ERROR_CODES.NOT_FOUND
          );
        }

        const deleted = await this.service.delete(id);

        return this.buildSuccessResponse(
          `${this.options.entityName} deleted successfully`,
          { deleted },
          {
            operation: 'delete',
            entityType: this.options.entityName,
            entityId: id,
            timestamp: new Date().toISOString(),
          }
        );
      },
      {
        requestId: context.requestId,
        operation: `delete_${this.options.entityName.toLowerCase()}`,
        ...(context.userId && { userId: context.userId }),
        additionalInfo: {
          entityType: this.options.entityName,
          basePath: this.options.basePath,
        },
      }
    );

    if (error) return error;
    return result!;
  }

  /**
   * Search entities with enhanced query processing
   */
  protected async search(context: HandlerContext): Promise<ApiResponse<any>> {
    const { result, error } = await this.executeServiceOrError(
      async () => {
        if (!this.service.search) {
          return this.buildErrorResponse(
            'Search not supported for this entity type',
            404,
            ERROR_CODES.NOT_FOUND
          );
        }

        // Enhanced query parameter parsing for search
        const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(
          context,
          {
            q: { type: 'string', required: true },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
            sortBy: { type: 'string' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            includeHighlights: { type: 'boolean', default: false },
          }
        );

        if (parseError) return parseError;

        const query = queryParams?.q?.trim();

        if (!query) {
          return this.buildErrorResponse(
            'Search query is required',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        // Enhanced pagination with search-specific defaults
        const paginationParams: PaginationParams = {
          page: Math.max(1, queryParams?.page || 1),
          limit: Math.min(50, Math.max(1, queryParams?.limit || 20)), // Lower max for search
          sortBy: queryParams?.sortBy,
          sortOrder: queryParams?.sortOrder as 'asc' | 'desc',
        };

        const result = await this.service.search(query, paginationParams);

        // Enhanced search response with query metadata
        const response = {
          query,
          items: result.items,
          pagination: {
            currentPage: paginationParams.page!,
            totalPages: Math.ceil(result.total / paginationParams.limit!),
            totalItems: result.total,
            itemsPerPage: paginationParams.limit!,
            hasNextPage: paginationParams.page! * paginationParams.limit! < result.total,
            hasPreviousPage: paginationParams.page! > 1,
          },
          metadata: {
            entityType: this.options.entityName,
            operation: 'search',
            searchQuery: query,
            timestamp: new Date().toISOString(),
            resultsFound: result.items.length,
            totalMatches: result.total,
          },
        };

        return this.buildSuccessResponse(
          `Found ${result.total} ${this.options.entityName.toLowerCase()}(s) matching "${query}"`,
          response
        );
      },
      {
        requestId: context.requestId,
        operation: `search_${this.options.entityName.toLowerCase()}`,
        ...(context.userId && { userId: context.userId }),
        additionalInfo: {
          entityType: this.options.entityName,
          basePath: this.options.basePath,
        },
      }
    );

    if (error) return error;
    return result!;
  }

  /**
   * Validate data for create operation
   * Override in concrete implementations
   */
  protected async validateCreateData(
    data: unknown
  ): Promise<{ isValid: boolean; errors?: ValidationError[] }> {
    // Default implementation - always valid
    // Override in concrete implementations with actual validation
    return { isValid: true };
  }

  /**
   * Validate data for update operation
   * Override in concrete implementations
   */
  protected async validateUpdateData(
    data: unknown
  ): Promise<{ isValid: boolean; errors?: ValidationError[] }> {
    // Default implementation - always valid
    // Override in concrete implementations with actual validation
    return { isValid: true };
  }

  /**
   * Validate ID format (basic implementation)
   * Override for entity-specific ID validation
   */
  protected isValidId(id: string): boolean {
    // Basic validation - not empty and reasonable length
    if (!id || id.trim().length === 0) {
      return false;
    }

    // Check for basic UUID format (can be overridden for other ID formats)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) || id.length <= 50; // Allow non-UUID IDs up to 50 chars
  }

  /**
   * Get performance metrics for this handler instance
   */
  protected getHandlerMetrics(): Record<string, any> {
    return {
      entityType: this.options.entityName,
      basePath: this.options.basePath,
      routesCount: this.routes.length,
      searchSupported: !!this.service.search,
      timestamp: new Date().toISOString(),
    };
  }
}
