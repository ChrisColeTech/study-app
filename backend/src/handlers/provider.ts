// Refactored Provider handler using middleware pattern
// Eliminates architecture violations: excessive validation boilerplate, mixed concerns, repetitive enum parsing

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import {
  GetProvidersRequest,
  GetProviderRequest,
  ProviderCategory,
  ProviderStatus,
  ProviderStatusEnum,
} from '../shared/types/provider.types';

// Import new middleware
import {
  ParsingMiddleware,
  ValidationMiddleware,
  ErrorHandlingMiddleware,
  AuthMiddleware,
  ErrorContexts,
  CommonParsing,
} from '../shared/middleware';
import { ValidationRules } from '../shared/validation/validation-rules';

export class ProviderHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'ProviderHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'GET',
        path: '/v1/providers',
        handler: this.getProviders.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/providers/{id}',
        handler: this.getProvider.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/providers/cache/refresh',
        handler: this.refreshCache.bind(this),
        requireAuth: false, // Will require admin auth in future phases
      },
    ];
  }

  /**
   * Get all providers with optional filtering - now clean and focused
   */
  private async getProviders(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters using middleware with specific config
    const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(context, {
      category: { type: 'string', decode: true },
      status: { type: 'string', decode: true },
      search: CommonParsing.search,
      includeInactive: CommonParsing.booleanFlag,
    });
    if (parseError) return parseError;

    // Validate enum values manually (simpler for now)
    if (
      queryParams.category &&
      !Object.values(ProviderCategory).includes(queryParams.category as ProviderCategory)
    ) {
      return this.buildErrorResponse(
        `Invalid category. Valid options: ${Object.values(ProviderCategory).join(', ')}`,
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (
      queryParams.status &&
      !Object.values(ProviderStatusEnum).includes(queryParams.status as ProviderStatus)
    ) {
      return this.buildErrorResponse(
        `Invalid status. Valid options: ${Object.values(ProviderStatusEnum).join(', ')}`,
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Build request object
    const request: GetProvidersRequest = {
      ...(queryParams.category && { category: queryParams.category as ProviderCategory }),
      ...(queryParams.status && { status: queryParams.status as ProviderStatus }),
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.includeInactive && { includeInactive: queryParams.includeInactive }),
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const providerService = this.serviceFactory.getProviderService();
        return await providerService.getProviders(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Provider.LIST,
        additionalInfo: { filters: request },
      }
    );

    if (error) return error;

    this.logger.info('Providers retrieved successfully', {
      requestId: context.requestId,
      total: result!.total,
      returned: result!.providers.length,
      filters: request,
    });

    return this.buildSuccessResponse('Providers retrieved successfully', result);
  }

  /**
   * Get a specific provider by ID - now clean and focused
   */
  private async getProvider(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate path parameters manually
    if (!pathParams.id) {
      return this.buildErrorResponse('Provider ID is required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(pathParams.id)) {
      return this.buildErrorResponse(
        'Invalid provider ID format',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Parse query parameters
    const { data: queryParams } = ParsingMiddleware.parseQueryParams(context, {
      includeCertifications: CommonParsing.booleanFlag,
    });

    // Build request object
    const request: GetProviderRequest = {
      id: pathParams.id,
      includeCertifications: queryParams?.includeCertifications !== false, // Default to true
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const providerService = this.serviceFactory.getProviderService();
        return await providerService.getProvider(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Provider.GET,
        additionalInfo: { providerId: request.id },
      }
    );

    if (error) return error;

    this.logger.info('Provider retrieved successfully', {
      requestId: context.requestId,
      providerId: result!.provider.id,
      providerName: result!.provider.name,
      certificationsCount: result!.provider.certifications.length,
    });

    return this.buildSuccessResponse('Provider retrieved successfully', result);
  }

  /**
   * Refresh provider cache - now clean and focused
   */
  private async refreshCache(context: HandlerContext): Promise<ApiResponse> {
    // Business logic only - delegate error handling to middleware
    const { error } = await this.executeServiceOrError(
      async () => {
        const providerService = this.serviceFactory.getProviderService();
        await providerService.refreshCache();
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Provider.REFRESH_CACHE,
      }
    );

    if (error) return error;

    this.logger.info('Provider cache refreshed successfully', {
      requestId: context.requestId,
    });

    return this.buildSuccessResponse('Cache refreshed successfully', {
      message: 'Provider cache refreshed successfully',
    });
  }
}

// Export handler function for Lambda
const providerHandler = new ProviderHandler();
export const handler = providerHandler.handle;
