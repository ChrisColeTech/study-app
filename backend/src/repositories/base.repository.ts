/**
 * Base Repository Implementation for Study App V3
 * 
 * Provides common functionality and standardized patterns for all repositories
 * following the helper class delegation pattern established in Objectives 11-15.
 * 
 * Objective 16: Repository Pattern Standardization
 */

import { 
  IBaseRepository, 
  RepositoryHealthStatus, 
  RepositoryError, 
  RepositoryErrorType,
  DependencyStatus,
  RepositoryConfig
} from '../shared/types/repository.types';
import { createLogger } from '../shared/logger';

/**
 * Abstract base repository class providing common functionality
 */
export abstract class BaseRepository implements IBaseRepository {
  protected logger: any;
  protected config: RepositoryConfig;

  constructor(
    protected repositoryName: string,
    config: any // Accept ServiceConfig and convert to RepositoryConfig
  ) {
    // Convert ServiceConfig to RepositoryConfig
    this.config = {
      tables: config.tables || {},
      s3: config.s3 || {},
      cache: {
        ttl: 300,
        maxSize: 1000,
        enabled: true
      },
      query: {
        defaultLimit: 20,
        maxLimit: 100,
        timeoutMs: 30000
      },
      health: {
        checkIntervalMs: 30000,
        timeoutMs: 5000,
        retryAttempts: 3
      }
    };
    this.logger = createLogger({ repository: repositoryName });
  }

  /**
   * Get repository name for logging and error tracking
   */
  getRepositoryName(): string {
    return this.repositoryName;
  }

  /**
   * Health check for repository dependencies
   */
  async healthCheck(): Promise<RepositoryHealthStatus> {
    this.logger.info(`Performing health check for ${this.repositoryName}`);
    
    try {
      const dependencies = await this.checkDependencies();
      const healthy = dependencies.every(dep => dep.healthy);
      
      const status: RepositoryHealthStatus = {
        healthy,
        repositoryName: this.repositoryName,
        dependencies,
        lastChecked: new Date().toISOString(),
        ...(healthy ? {} : { errors: dependencies.filter(d => !d.healthy).map(d => d.error || 'Unknown error') })
      };

      this.logger.info(`Health check completed for ${this.repositoryName}`, { status: status.healthy });
      return status;
    } catch (error) {
      this.logger.error(`Health check failed for ${this.repositoryName}`, error as Error);
      
      return {
        healthy: false,
        repositoryName: this.repositoryName,
        dependencies: [],
        lastChecked: new Date().toISOString(),
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Check specific dependencies - to be implemented by subclasses
   */
  protected abstract checkDependencies(): Promise<DependencyStatus[]>;

  /**
   * Execute operation with standardized error handling and logging
   */
  protected async executeWithErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    this.logger.debug(`Starting ${operation} in ${this.repositoryName}`, context);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.logger.info(`Successfully completed ${operation} in ${this.repositoryName}`, {
        duration,
        ...context
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed ${operation} in ${this.repositoryName}`, error as Error, {
        duration,
        ...context
      });
      
      // Re-throw as standardized RepositoryError if not already one
      if (error instanceof RepositoryError) {
        throw error;
      }
      
      throw this.createRepositoryError(operation, error as Error, context);
    }
  }

  /**
   * Create standardized repository error
   */
  protected createRepositoryError(
    operation: string,
    cause: Error,
    context?: Record<string, any>
  ): RepositoryError {
    // Determine error type based on the original error
    let errorType = RepositoryErrorType.INTERNAL_ERROR;
    
    if (cause.message.includes('not found') || cause.message.includes('NotFound')) {
      errorType = RepositoryErrorType.NOT_FOUND;
    } else if (cause.message.includes('validation') || cause.message.includes('ValidationError')) {
      errorType = RepositoryErrorType.VALIDATION_ERROR;
    } else if (cause.message.includes('connection') || cause.message.includes('NetworkError')) {
      errorType = RepositoryErrorType.CONNECTION_ERROR;
    } else if (cause.message.includes('timeout') || cause.message.includes('TimeoutError')) {
      errorType = RepositoryErrorType.TIMEOUT_ERROR;
    } else if (cause.message.includes('permission') || cause.message.includes('AccessDenied')) {
      errorType = RepositoryErrorType.PERMISSION_ERROR;
    } else if (cause.message.includes('constraint') || cause.message.includes('ConditionalCheckFailed')) {
      errorType = RepositoryErrorType.CONSTRAINT_VIOLATION;
    }

    return new RepositoryError(
      errorType,
      `${this.repositoryName}.${operation}: ${cause.message}`,
      this.repositoryName,
      operation,
      cause,
      context
    );
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, operation: string): void {
    const missing = Object.entries(params)
      .filter(([_, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new RepositoryError(
        RepositoryErrorType.VALIDATION_ERROR,
        `Missing required parameters: ${missing.join(', ')}`,
        this.repositoryName,
        operation,
        undefined,
        { missingParams: missing }
      );
    }
  }

  /**
   * Validate entity exists
   */
  protected validateEntityExists<T>(entity: T | null, id: string, operation: string): T {
    if (!entity) {
      throw new RepositoryError(
        RepositoryErrorType.NOT_FOUND,
        `Entity not found`,
        this.repositoryName,
        operation,
        undefined,
        { entityId: id }
      );
    }
    return entity;
  }
}

/**
 * DynamoDB-specific base repository with common DynamoDB patterns
 */
export abstract class DynamoDBBaseRepository extends BaseRepository {
  constructor(
    repositoryName: string,
    config: any,
    protected tableName: string
  ) {
    super(repositoryName, config);
  }

  /**
   * Check DynamoDB dependency health
   */
  protected async checkDependencies(): Promise<DependencyStatus[]> {
    const startTime = Date.now();
    
    try {
      // Perform a simple operation to test DynamoDB connectivity
      // This would be implemented by subclasses with actual DynamoDB client
      await this.performHealthCheck();
      
      return [{
        name: 'DynamoDB',
        type: 'dynamodb',
        healthy: true,
        responseTime: Date.now() - startTime
      }];
    } catch (error) {
      return [{
        name: 'DynamoDB',
        type: 'dynamodb',
        healthy: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message
      }];
    }
  }

  /**
   * Perform health check operation - to be implemented by subclasses
   */
  protected abstract performHealthCheck(): Promise<void>;

  /**
   * Build pagination parameters
   */
  protected buildPaginationParams(limit?: number, lastEvaluatedKey?: any) {
    const params: any = {};
    
    if (limit) {
      params.Limit = Math.min(limit, this.config.query?.maxLimit || 100);
    } else {
      params.Limit = this.config.query?.defaultLimit || 20;
    }
    
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }
    
    return params;
  }
}

/**
 * S3-specific base repository with common S3 patterns
 */
export abstract class S3BaseRepository extends BaseRepository {
  constructor(
    repositoryName: string,
    config: any,
    protected bucketName: string
  ) {
    super(repositoryName, config);
  }

  /**
   * Check S3 dependency health
   */
  protected async checkDependencies(): Promise<DependencyStatus[]> {
    const startTime = Date.now();
    
    try {
      // Perform a simple operation to test S3 connectivity
      // This would be implemented by subclasses with actual S3 client
      await this.performHealthCheck();
      
      return [{
        name: 'S3',
        type: 's3',
        healthy: true,
        responseTime: Date.now() - startTime
      }];
    } catch (error) {
      return [{
        name: 'S3',
        type: 's3',
        healthy: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message
      }];
    }
  }

  /**
   * Perform health check operation - to be implemented by subclasses
   */
  protected abstract performHealthCheck(): Promise<void>;

  /**
   * Build S3 object key with standardized pattern
   */
  protected buildObjectKey(...parts: string[]): string {
    return parts.filter(part => part && part.trim()).join('/');
  }
}