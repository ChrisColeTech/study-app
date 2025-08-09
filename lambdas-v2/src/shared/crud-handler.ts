import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from './base-handler';

/**
 * CRUD Handler Base Class - Provides standard CRUD operations
 * 
 * This extends BaseHandler with common CRUD patterns:
 * - GET /resource -> list()
 * - GET /resource/{id} -> get(id)
 * - POST /resource -> create(data)
 * - PUT /resource/{id} -> update(id, data)
 * - DELETE /resource/{id} -> delete(id)
 */
export abstract class CrudHandler<T = any> extends BaseHandler {
  constructor(handlerName: string, private resourceName: string) {
    super(handlerName);
  }

  /**
   * Main CRUD router - handles HTTP method routing automatically
   */
  public async handleCrudRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod } = event;
    const resourceId = this.getPathParam(event, 'id');

    try {
      switch (httpMethod) {
        case 'GET':
          return resourceId ? 
            this.handleGet(resourceId, userId, event) : 
            this.handleList(userId, event);
        
        case 'POST':
          const createData = this.parseJsonBody<T>(event);
          return this.handleCreate(createData, userId, event);
        
        case 'PUT':
          if (!resourceId) {
            return this.badRequest('Resource ID is required for PUT operations');
          }
          const updateData = this.parseJsonBody<Partial<T>>(event);
          return this.handleUpdate(resourceId, updateData, userId, event);
        
        case 'DELETE':
          if (!resourceId) {
            return this.badRequest('Resource ID is required for DELETE operations');
          }
          return this.handleDelete(resourceId, userId, event);
        
        default:
          return this.methodNotAllowed(`${httpMethod} method not supported for ${this.resourceName}`);
      }
    } catch (error) {
      this.logger.error(`CRUD operation failed for ${this.resourceName}`, error);
      throw error; // Let base handler catch and format
    }
  }

  // Abstract methods that implementing classes must provide
  protected abstract handleList(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;
  protected abstract handleGet(id: string, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;
  protected abstract handleCreate(data: T | null, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;
  protected abstract handleUpdate(id: string, data: Partial<T> | null, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;
  protected abstract handleDelete(id: string, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;

  // Common validation helpers
  protected validateRequiredFields(data: any, requiredFields: string[]): string[] {
    const missing = requiredFields.filter(field => !data || data[field] === undefined || data[field] === null);
    return missing;
  }

  protected validateCreateData(data: T | null): APIGatewayProxyResult | null {
    if (!data) {
      return this.badRequest('Request body is required');
    }
    return null;
  }

  protected validateUpdateData(data: Partial<T> | null): APIGatewayProxyResult | null {
    if (!data) {
      return this.badRequest('Request body is required for updates');
    }
    return null;
  }

  // Common response helpers for CRUD operations
  protected listResponse<T>(items: T[], totalCount?: number, message?: string): APIGatewayProxyResult {
    return this.success({
      items,
      count: items.length,
      ...(totalCount !== undefined && { totalCount })
    }, message || `${this.resourceName} list retrieved successfully`);
  }

  protected itemResponse<T>(item: T, message?: string): APIGatewayProxyResult {
    return this.success(item, message || `${this.resourceName} retrieved successfully`);
  }

  protected createdResponse<T>(item: T, message?: string): APIGatewayProxyResult {
    return this.created(item, message || `${this.resourceName} created successfully`);
  }

  protected updatedResponse<T>(item: T, message?: string): APIGatewayProxyResult {
    return this.success(item, message || `${this.resourceName} updated successfully`);
  }

  protected deletedResponse(message?: string): APIGatewayProxyResult {
    return this.noContent();
  }

  protected notFoundResponse(id: string): APIGatewayProxyResult {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: `${this.resourceName} with ID '${id}' not found` 
      })
    };
  }

  protected override badRequest(message: string): APIGatewayProxyResult {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: message 
      })
    };
  }

  private methodNotAllowed(message: string): APIGatewayProxyResult {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: message 
      })
    };
  }
}