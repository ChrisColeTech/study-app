/**
 * Repository Pattern Standardization for Study App V3
 *
 * This file defines standardized base interfaces and patterns for all repositories
 * following the helper class delegation pattern established in Objectives 11-15.
 *
 * Objective 16: Repository Pattern Standardization
 */

import { ServiceConfig } from '../service-factory';

// ========================================
// Base Repository Interfaces
// ========================================

/**
 * Base interface for all repositories with common error handling and logging patterns
 */
export interface IBaseRepository {
  /**
   * Get repository name for logging and error tracking
   */
  getRepositoryName(): string;

  /**
   * Health check for repository dependencies
   */
  healthCheck(): Promise<RepositoryHealthStatus>;

  /**
   * Clear repository cache if applicable - standardized optional method
   */
  clearCache?(): void;
}

/**
 * Standardized interface for CRUD operations across all repositories
 * All repositories should implement this interface with appropriate entity types
 */
export interface IStandardCrudRepository<T, CreateRequest, UpdateRequest, FilterRequest = any>
  extends IBaseRepository {
  /**
   * Create a new entity
   * @param data - Entity creation data
   * @returns Promise<T> - Created entity
   * @throws RepositoryError
   */
  create(data: CreateRequest): Promise<T>;

  /**
   * Find entity by primary key/ID
   * @param id - Entity identifier
   * @returns Promise<T | null> - Entity if found, null if not found
   * @throws RepositoryError
   */
  findById(id: string): Promise<T | null>;

  /**
   * Update an existing entity
   * @param id - Entity identifier
   * @param updateData - Partial entity data to update
   * @returns Promise<T> - Updated entity
   * @throws RepositoryError
   */
  update(id: string, updateData: UpdateRequest): Promise<T>;

  /**
   * Delete an entity
   * @param id - Entity identifier
   * @returns Promise<boolean> - true if deleted, false if not found
   * @throws RepositoryError
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if entity exists
   * @param id - Entity identifier
   * @returns Promise<boolean> - true if exists, false otherwise
   * @throws RepositoryError
   */
  exists(id: string): Promise<boolean>;

  /**
   * Find all entities with optional filtering and pagination - standardized
   * @param filters - Optional filtering and pagination parameters
   * @returns Promise<StandardQueryResult<T>> - Standardized paginated results
   * @throws RepositoryError
   */
  findAll?(filters?: FilterRequest): Promise<StandardQueryResult<T>>;
}

/**
 * Standardized interface for repositories that support user-scoped queries
 */
export interface IUserScopedRepository<T, FilterRequest = any> {
  /**
   * Find entities by user ID with optional filtering and pagination
   * @param userId - User identifier
   * @param filters - Optional filtering parameters
   * @returns Promise<StandardQueryResult<T>> - Paginated results
   * @throws RepositoryError
   */
  findByUserId(userId: string, filters?: FilterRequest): Promise<StandardQueryResult<T>>;
}

/**
 * Standardized interface for repositories that support list/search operations
 */
export interface IListRepository<T, FilterRequest = any> extends IBaseRepository {
  /**
   * Find all entities with optional filtering and pagination - standardized
   * @param filters - Optional filtering parameters
   * @returns Promise<StandardQueryResult<T>> - Standardized paginated results
   * @throws RepositoryError
   */
  findAll(filters?: FilterRequest): Promise<StandardQueryResult<T>>;

  /**
   * Find entity by ID - standardized across all list repositories
   * @param id - Entity identifier
   * @returns Promise<T | null> - Entity if found, null if not found
   * @throws RepositoryError
   */
  findById(id: string): Promise<T | null>;
}

/**
 * Standardized query result structure for pagination
 */
export interface StandardQueryResult<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
  lastEvaluatedKey?: any; // For DynamoDB pagination
  hasMore?: boolean; // Indicates if more items are available
  executionTimeMs?: number; // Query execution time for performance monitoring
}

/**
 * Standardized pagination parameters
 */
export interface StandardPaginationParams {
  limit?: number;
  offset?: number;
  lastEvaluatedKey?: any; // For DynamoDB pagination
}

/**
 * Standardized query parameters for all repositories
 */
export interface StandardQueryParams extends StandardPaginationParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

/**
 * Standardized cache configuration for repositories
 */
export interface StandardCacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache entries
  enabled: boolean; // Cache enabled flag
}

/**
 * Standardized filter base interface
 */
export interface StandardFilterParams extends StandardPaginationParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC'; // Consistent with StandardQueryParams
}

/**
 * Standard CRUD operations interface for DynamoDB-based repositories
 */
export interface ICrudRepository<T, TCreateRequest, TUpdateRequest, TFilters = any>
  extends IBaseRepository {
  /**
   * Create a new entity
   * @param data - Entity creation data
   * @returns Promise<T> - Created entity
   * @throws RepositoryError - Standardized repository error
   */
  create(data: TCreateRequest): Promise<T>;

  /**
   * Find entity by ID
   * @param id - Unique identifier
   * @returns Promise<T | null> - Entity or null if not found
   * @throws RepositoryError - Standardized repository error
   */
  findById(id: string): Promise<T | null>;

  /**
   * Update existing entity
   * @param id - Unique identifier
   * @param updateData - Partial update data
   * @returns Promise<T> - Updated entity
   * @throws RepositoryError - Standardized repository error
   */
  update(id: string, updateData: TUpdateRequest): Promise<T>;

  /**
   * Delete entity by ID
   * @param id - Unique identifier
   * @returns Promise<boolean> - Success status
   * @throws RepositoryError - Standardized repository error
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if entity exists
   * @param id - Unique identifier
   * @returns Promise<boolean> - Existence status
   * @throws RepositoryError - Standardized repository error
   */
  exists(id: string): Promise<boolean>;

  /**
   * Find entities with filters and pagination
   * @param filters - Query filters
   * @returns Promise<PaginatedResult<T>> - Paginated results
   * @throws RepositoryError - Standardized repository error
   */
  findWithFilters(filters: TFilters): Promise<PaginatedResult<T>>;
}

/**
 * Standard read-only operations interface for S3-based repositories
 */
export interface IReadOnlyRepository<T, TFilters = any> extends IBaseRepository {
  /**
   * Find all entities
   * @returns Promise<T[]> - All entities
   * @throws RepositoryError - Standardized repository error
   */
  findAll(): Promise<T[]>;

  /**
   * Find entity by ID
   * @param id - Unique identifier
   * @returns Promise<T | null> - Entity or null if not found
   * @throws RepositoryError - Standardized repository error
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find entities with filters
   * @param filters - Query filters
   * @returns Promise<T[]> - Filtered entities
   * @throws RepositoryError - Standardized repository error
   */
  findWithFilters(filters: TFilters): Promise<T[]>;

  /**
   * Clear repository cache
   */
  clearCache(): void;

  /**
   * Refresh cache from source
   * @returns Promise<void>
   * @throws RepositoryError - Standardized repository error
   */
  refreshCache(): Promise<void>;
}

/**
 * Analytical repository interface for complex data operations
 */
export interface IAnalyticalRepository<T> extends IBaseRepository {
  /**
   * Get aggregated data with complex queries
   * @param query - Analytical query parameters
   * @returns Promise<T[]> - Aggregated results
   * @throws RepositoryError - Standardized repository error
   */
  getAggregatedData(query: AnalyticalQuery): Promise<T[]>;

  /**
   * Save snapshot for caching
   * @param snapshot - Data snapshot
   * @returns Promise<void>
   * @throws RepositoryError - Standardized repository error
   */
  saveSnapshot(snapshot: DataSnapshot): Promise<void>;

  /**
   * Get cached snapshot
   * @param key - Snapshot key
   * @returns Promise<DataSnapshot | null> - Cached snapshot or null
   * @throws RepositoryError - Standardized repository error
   */
  getSnapshot(key: string): Promise<DataSnapshot | null>;
}

// ========================================
// Error Handling Standardization
// ========================================

/**
 * Standardized repository error types
 */
export enum RepositoryErrorType {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Standardized repository error class
 */
export class RepositoryError extends Error {
  public readonly type: RepositoryErrorType;
  public readonly repositoryName: string;
  public readonly operation: string;
  public readonly cause?: Error;
  public readonly context?: Record<string, any>;

  constructor(
    type: RepositoryErrorType,
    message: string,
    repositoryName: string,
    operation: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'RepositoryError';
    this.type = type;
    this.repositoryName = repositoryName;
    this.operation = operation;
    if (cause !== undefined) {
      this.cause = cause;
    }
    if (context !== undefined) {
      this.context = context;
    }
  }
}

// ========================================
// Common Types
// ========================================

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Repository health status
 */
export interface RepositoryHealthStatus {
  healthy: boolean;
  repositoryName: string;
  dependencies: DependencyStatus[];
  lastChecked: string;
  errors?: string[];
}

/**
 * Dependency status for health checks
 */
export interface DependencyStatus {
  name: string;
  type: 'dynamodb' | 's3' | 'redis' | 'external';
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

/**
 * Analytical query parameters
 */
export interface AnalyticalQuery {
  userId?: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, any>;
  aggregations?: string[];
  groupBy?: string[];
}

/**
 * Data snapshot for caching
 */
export interface DataSnapshot {
  key: string;
  data: any;
  timestamp: string;
  expiresAt: string;
  metadata?: Record<string, any>;
}

// ========================================
// Query Pattern Standardization
// ========================================

/**
 * Standard query builder interface for complex queries
 */
export interface IQueryBuilder<T> {
  /**
   * Add filter condition
   * @param field - Field name
   * @param operator - Query operator
   * @param value - Filter value
   * @returns IQueryBuilder<T> - Fluent interface
   */
  where(field: string, operator: QueryOperator, value: any): IQueryBuilder<T>;

  /**
   * Add sorting
   * @param field - Field name
   * @param direction - Sort direction
   * @returns IQueryBuilder<T> - Fluent interface
   */
  orderBy(field: string, direction: 'asc' | 'desc'): IQueryBuilder<T>;

  /**
   * Set pagination
   * @param limit - Items per page
   * @param offset - Page offset
   * @returns IQueryBuilder<T> - Fluent interface
   */
  paginate(limit: number, offset?: number): IQueryBuilder<T>;

  /**
   * Execute query
   * @returns Promise<PaginatedResult<T>> - Query results
   */
  execute(): Promise<PaginatedResult<T>>;
}

/**
 * Query operators for filtering
 */
export enum QueryOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  CONTAINS = 'contains',
  BEGINS_WITH = 'begins_with',
  IN = 'in',
  BETWEEN = 'between',
}

// ========================================
// Helper Class Pattern Interfaces
// ========================================

/**
 * Cache manager interface for repositories with caching
 */
export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

/**
 * Data transformer interface for data format conversions
 */
export interface IDataTransformer<TSource, TTarget> {
  transform(source: TSource): TTarget;
  transformArray(sources: TSource[]): TTarget[];
  reverse(target: TTarget): TSource;
}

/**
 * Query builder interface for complex database queries
 */
export interface IDatabaseQueryBuilder {
  buildFilterExpression(filters: Record<string, any>): string;
  buildUpdateExpression(updates: Record<string, any>): string;
  buildProjectionExpression(fields: string[]): string;
  buildExpressionAttributeNames(expression: string): Record<string, string>;
  buildExpressionAttributeValues(values: Record<string, any>): Record<string, any>;
}

// ========================================
// Repository Configuration
// ========================================

/**
 * Repository configuration interface
 */
export interface RepositoryConfig {
  // Include essential ServiceConfig properties
  tables: {
    users: string;
    studySessions: string;
    goals: string;
    userProgress: string;
  };
  s3: {
    bucketName: string;
  };

  // Cache settings
  cache?: {
    ttl: number;
    maxSize: number;
    enabled: boolean;
  };

  // Query settings
  query?: {
    defaultLimit: number;
    maxLimit: number;
    timeoutMs: number;
  };

  // Health check settings
  health?: {
    checkIntervalMs: number;
    timeoutMs: number;
    retryAttempts: number;
  };
}
