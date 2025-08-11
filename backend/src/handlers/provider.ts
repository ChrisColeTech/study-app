// Provider handler for Study App V3 Backend

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  GetProvidersRequest, 
  GetProviderRequest,
  ProviderCategory,
  ProviderStatus 
} from '../shared/types/provider.types';

export class ProviderHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'ProviderHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // Get all providers endpoint
      {
        method: 'GET',
        path: '/v1/providers',
        handler: this.getProviders.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Get specific provider endpoint
      {
        method: 'GET',
        path: '/v1/providers/{id}',
        handler: this.getProvider.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Refresh provider cache endpoint (admin only in future)
      {
        method: 'POST',
        path: '/v1/providers/cache/refresh',
        handler: this.refreshCache.bind(this),
        requireAuth: false, // Will require admin auth in future phases
      }
    ];
  }

  /**
   * Get all providers with optional filtering
   * GET /v1/providers?category=cloud&status=active&search=aws&includeInactive=false
   */
  private async getProviders(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Getting all providers', { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetProvidersRequest = {};
      
      // Only set properties if they have values
      const category = this.parseEnumParam(queryParams.category, ProviderCategory);
      if (category !== undefined) {
        request.category = category;
      }
      
      const status = this.parseEnumParam(queryParams.status, ProviderStatus);
      if (status !== undefined) {
        request.status = status;
      }
      
      if (queryParams.search) {
        request.search = decodeURIComponent(queryParams.search);
      }
      
      if (queryParams.includeInactive === 'true') {
        request.includeInactive = true;
      }

      // Validate category if provided
      if (queryParams.category && !request.category) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid category. Valid options: ${Object.values(ProviderCategory).join(', ')}`
        );
      }

      // Validate status if provided
      if (queryParams.status && !request.status) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid status. Valid options: ${Object.values(ProviderStatus).join(', ')}`
        );
      }

      // Get providers from service
      const providerService = this.serviceFactory.getProviderService();
      const result = await providerService.getProviders(request);

      this.logger.info('Providers retrieved successfully', { 
        requestId: context.requestId,
        total: result.total,
        filters: {
          category: request.category,
          status: request.status,
          search: request.search,
          includeInactive: request.includeInactive
        }
      });

      return this.success(result, 'Providers retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get providers', error, { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve providers'
      );
    }
  }

  /**
   * Get a specific provider by ID
   * GET /v1/providers/{id}?includeCertifications=true
   */
  private async getProvider(context: HandlerContext): Promise<ApiResponse> {
    try {
      // Extract provider ID from path parameters
      const providerId = context.event.pathParameters?.id;
      
      if (!providerId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Provider ID is required'
        );
      }

      // Validate provider ID format (alphanumeric, hyphens, underscores)
      if (!/^[a-zA-Z0-9_-]+$/.test(providerId)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid provider ID format'
        );
      }

      this.logger.info('Getting provider', { 
        requestId: context.requestId,
        providerId,
        queryParams: context.event.queryStringParameters
      });

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetProviderRequest = {
        id: providerId,
        includeCertifications: queryParams.includeCertifications !== 'false' // Default to true
      };

      // Get provider from service
      const providerService = this.serviceFactory.getProviderService();
      const result = await providerService.getProvider(request);

      this.logger.info('Provider retrieved successfully', { 
        requestId: context.requestId,
        providerId: result.provider.id,
        providerName: result.provider.name,
        certificationsCount: result.provider.certifications.length
      });

      return this.success(result, 'Provider retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get provider', error, { 
        requestId: context.requestId,
        providerId: context.event.pathParameters?.id
      });

      // Handle specific error types
      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve provider'
      );
    }
  }

  /**
   * Refresh provider cache
   * POST /v1/providers/cache/refresh
   */
  private async refreshCache(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Refreshing provider cache', { 
        requestId: context.requestId
      });

      // Refresh cache
      const providerService = this.serviceFactory.getProviderService();
      await providerService.refreshCache();

      this.logger.info('Provider cache refreshed successfully', { 
        requestId: context.requestId
      });

      return this.success(
        { message: 'Provider cache refreshed successfully' }, 
        'Cache refreshed successfully'
      );

    } catch (error: any) {
      this.logger.error('Failed to refresh cache', error, { 
        requestId: context.requestId
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to refresh provider cache'
      );
    }
  }

  /**
   * Helper method to parse enum parameters safely
   */
  private parseEnumParam<T extends Record<string, string>>(
    value: string | undefined, 
    enumObj: T
  ): T[keyof T] | undefined {
    if (!value) return undefined;
    
    const upperValue = value.toUpperCase();
    const enumValues = Object.values(enumObj) as string[];
    
    return enumValues.find(v => v.toUpperCase() === upperValue) as T[keyof T] | undefined;
  }
}

// Export handler function for Lambda
const providerHandler = new ProviderHandler();
export const handler = providerHandler.handle;