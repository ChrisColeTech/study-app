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
   * Create a new entity
   */
  protected async create(context: HandlerContext): Promise<ApiResponse<T>> {
    try {
      const body = this.parseBody<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>(context);
      
      if (!body) {
        return this.error(ERROR_CODES.VALIDATION_ERROR, 'Request body is required');
      }

      // Validate create data
      const validationResult = await this.validateCreateData(body);
      if (!validationResult.isValid) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR, 
          'Validation failed', 
          validationResult.errors
        );
      }

      const entity = await this.service.create(body);
      
      return this.success(entity, `${this.options.entityName} created successfully`);
    } catch (error) {
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to create ${this.options.entityName.toLowerCase()}`,
        error
      );
    }
  }

  /**
   * Get all entities with pagination
   */
  protected async getAll(context: HandlerContext): Promise<ApiResponse<any>> {
    try {
      const queryParams = this.getQueryParameters(context);
      const paginationParams: PaginationParams = {
        page: queryParams.page ? parseInt(queryParams.page, 10) : 1,
        limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 20,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder as 'asc' | 'desc',
      };

      const result = await this.service.getAll(paginationParams);
      
      const response = {
        items: result.items,
        pagination: {
          currentPage: paginationParams.page!,
          totalPages: Math.ceil(result.total / paginationParams.limit!),
          totalItems: result.total,
          itemsPerPage: paginationParams.limit!,
          hasNextPage: (paginationParams.page! * paginationParams.limit!) < result.total,
          hasPreviousPage: paginationParams.page! > 1,
        },
      };

      return this.success(response);
    } catch (error) {
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to get ${this.options.entityName.toLowerCase()}s`,
        error
      );
    }
  }

  /**
   * Get entity by ID
   */
  protected async getById(context: HandlerContext): Promise<ApiResponse<T>> {
    try {
      const { id } = this.getPathParameters(context);
      
      if (!id) {
        return this.error(ERROR_CODES.VALIDATION_ERROR, 'ID parameter is required');
      }

      const entity = await this.service.getById(id);
      
      if (!entity) {
        return this.error(ERROR_CODES.NOT_FOUND, `${this.options.entityName} not found`);
      }

      return this.success(entity);
    } catch (error) {
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to get ${this.options.entityName.toLowerCase()}`,
        error
      );
    }
  }

  /**
   * Update entity by ID
   */
  protected async update(context: HandlerContext): Promise<ApiResponse<T>> {
    try {
      const { id } = this.getPathParameters(context);
      const body = this.parseBody<Partial<Omit<T, 'id' | 'createdAt'>>>(context);
      
      if (!id) {
        return this.error(ERROR_CODES.VALIDATION_ERROR, 'ID parameter is required');
      }

      if (!body) {
        return this.error(ERROR_CODES.VALIDATION_ERROR, 'Request body is required');
      }

      // Check if entity exists
      const existingEntity = await this.service.getById(id);
      if (!existingEntity) {
        return this.error(ERROR_CODES.NOT_FOUND, `${this.options.entityName} not found`);
      }

      // Validate update data
      const validationResult = await this.validateUpdateData(body);
      if (!validationResult.isValid) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          validationResult.errors
        );
      }

      const updatedEntity = await this.service.update(id, body);
      
      return this.success(updatedEntity, `${this.options.entityName} updated successfully`);
    } catch (error) {
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to update ${this.options.entityName.toLowerCase()}`,
        error
      );
    }
  }

  /**
   * Delete entity by ID
   */
  protected async delete(context: HandlerContext): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const { id } = this.getPathParameters(context);
      
      if (!id) {
        return this.error(ERROR_CODES.VALIDATION_ERROR, 'ID parameter is required');
      }

      // Check if entity exists
      const existingEntity = await this.service.getById(id);
      if (!existingEntity) {
        return this.error(ERROR_CODES.NOT_FOUND, `${this.options.entityName} not found`);
      }

      const deleted = await this.service.delete(id);
      
      return this.success(
        { deleted },
        `${this.options.entityName} deleted successfully`
      );
    } catch (error) {
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to delete ${this.options.entityName.toLowerCase()}`,
        error
      );
    }
  }

  /**
   * Search entities
   */
  protected async search(context: HandlerContext): Promise<ApiResponse<any>> {
    try {
      if (!this.service.search) {
        return this.error(ERROR_CODES.NOT_FOUND, 'Search not supported');
      }

      const queryParams = this.getQueryParameters(context);
      const query = queryParams.q || '';
      
      if (!query.trim()) {
        return this.error(ERROR_CODES.VALIDATION_ERROR, 'Search query is required');
      }

      const paginationParams: PaginationParams = {
        page: queryParams.page ? parseInt(queryParams.page, 10) : 1,
        limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 20,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder as 'asc' | 'desc',
      };

      const result = await this.service.search(query, paginationParams);
      
      const response = {
        query,
        items: result.items,
        pagination: {
          currentPage: paginationParams.page!,
          totalPages: Math.ceil(result.total / paginationParams.limit!),
          totalItems: result.total,
          itemsPerPage: paginationParams.limit!,
          hasNextPage: (paginationParams.page! * paginationParams.limit!) < result.total,
          hasPreviousPage: paginationParams.page! > 1,
        },
      };

      return this.success(response);
    } catch (error) {
      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        `Failed to search ${this.options.entityName.toLowerCase()}s`,
        error
      );
    }
  }

  /**
   * Validate data for create operation
   * Override in concrete implementations
   */
  protected async validateCreateData(data: unknown): Promise<{ isValid: boolean; errors?: ValidationError[] }> {
    // Default implementation - always valid
    // Override in concrete implementations with actual validation
    return { isValid: true };
  }

  /**
   * Validate data for update operation
   * Override in concrete implementations
   */
  protected async validateUpdateData(data: unknown): Promise<{ isValid: boolean; errors?: ValidationError[] }> {
    // Default implementation - always valid
    // Override in concrete implementations with actual validation
    return { isValid: true };
  }
}