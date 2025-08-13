// Base service class providing standardized error handling patterns
// Eliminates duplicate error handling logic across all services

import { createLogger } from './logger';

export interface ErrorContext {
  operation: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  requestData?: any;
}

export abstract class BaseService {
  protected logger: ReturnType<typeof createLogger>;

  constructor() {
    this.logger = createLogger({ component: this.constructor.name });
  }

  /**
   * Standardized error handling wrapper for service operations
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logError(error as Error, context);
      throw error;
    }
  }

  /**
   * Standardized success logging with consistent format
   */
  protected logSuccess(
    message: string,
    context: Partial<ErrorContext> & Record<string, any>
  ): void {
    this.logger.info(message, context);
  }

  /**
   * Standardized debug logging with consistent format
   */
  protected logDebug(message: string, context: Partial<ErrorContext> & Record<string, any>): void {
    this.logger.debug(message, context);
  }

  /**
   * Standardized warning logging with consistent format
   */
  protected logWarning(
    message: string,
    context: Partial<ErrorContext> & Record<string, any>
  ): void {
    this.logger.warn(message, context);
  }

  /**
   * Standardized error logging with consistent format
   */
  private logError(error: Error, context: ErrorContext): void {
    const logContext: Record<string, any> = {
      operation: context.operation,
    };

    if (context.entityType) logContext.entityType = context.entityType;
    if (context.entityId) logContext.entityId = context.entityId;
    if (context.userId) logContext.userId = context.userId;
    if (context.requestData) logContext.requestData = context.requestData;

    this.logger.error(`Failed to ${context.operation}`, error, logContext);
  }

  /**
   * Create standardized not found error
   */
  protected createNotFoundError(entityType: string, entityId: string): Error {
    return new Error(`${entityType} not found: ${entityId}`);
  }

  /**
   * Create standardized validation error
   */
  protected createValidationError(message: string): Error {
    return new Error(message);
  }

  /**
   * Create standardized business logic error
   */
  protected createBusinessError(message: string): Error {
    return new Error(message);
  }

  /**
   * Validate required parameter and throw if missing
   */
  protected validateRequired<T>(value: T | undefined | null, paramName: string): T {
    if (value === undefined || value === null) {
      throw this.createValidationError(`${paramName} is required`);
    }
    return value;
  }

  /**
   * Validate entity exists and throw if not found
   */
  protected validateEntityExists<T>(
    entity: T | null | undefined,
    entityType: string,
    entityId: string
  ): T {
    if (!entity) {
      throw this.createNotFoundError(entityType, entityId);
    }
    return entity;
  }
}
