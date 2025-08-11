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
  ProviderStatus,
  // Phase 7: Enhanced provider detail types
  GetCertificationRoadmapRequest,
  GetStudyPathRecommendationsRequest,
  GetProviderResourcesRequest,
  GetPersonalizedRecommendationsRequest,
  UserLearningPreferences,
  ExperienceLevel,
  LearningStyle,
  ResourceCategory,
  ResourceType
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
      // Phase 7: Get certification roadmaps for a provider
      {
        method: 'GET',
        path: '/v1/providers/{id}/roadmaps',
        handler: this.getCertificationRoadmaps.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Phase 7: Get study path recommendations
      {
        method: 'POST',
        path: '/v1/providers/{id}/recommendations/study-paths',
        handler: this.getStudyPathRecommendations.bind(this),
        requireAuth: false, // Public endpoint for now (POST for user preferences in body)
      },
      // Phase 7: Get provider resources and learning materials
      {
        method: 'GET',
        path: '/v1/providers/{id}/resources',
        handler: this.getProviderResources.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Phase 7: Get personalized recommendations (can work across all providers)
      {
        method: 'POST',
        path: '/v1/providers/recommendations/personalized',
        handler: this.getPersonalizedRecommendations.bind(this),
        requireAuth: false, // Public endpoint for now (POST for user preferences in body)
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
   * Phase 7: Get certification roadmaps for a provider
   * GET /v1/providers/{id}/roadmaps?roadmapId=foundational-path
   * POST with user preferences in body for personalized recommendations
   */
  private async getCertificationRoadmaps(context: HandlerContext): Promise<ApiResponse> {
    try {
      const providerId = context.event.pathParameters?.id;
      
      if (!providerId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Provider ID is required'
        );
      }

      this.logger.info('Getting certification roadmaps', { 
        requestId: context.requestId,
        providerId,
        queryParams: context.event.queryStringParameters
      });

      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetCertificationRoadmapRequest = {
        providerId
      };
      
      if (queryParams.roadmapId) {
        request.roadmapId = queryParams.roadmapId;
      }

      // If this is a POST request, parse user preferences from body
      if (context.event.httpMethod === 'POST' && context.event.body) {
        try {
          const body = JSON.parse(context.event.body);
          if (body.userPreferences) {
            request.userPreferences = this.validateUserPreferences(body.userPreferences);
          }
        } catch (parseError) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid JSON in request body'
          );
        }
      }

      const providerService = this.serviceFactory.getProviderService();
      const result = await providerService.getCertificationRoadmaps(request);

      this.logger.info('Certification roadmaps retrieved successfully', { 
        requestId: context.requestId,
        providerId,
        roadmapsCount: result.roadmaps.length,
        hasPersonalized: !!result.personalizedRecommendations
      });

      return this.success(result, 'Certification roadmaps retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get certification roadmaps', error, { 
        requestId: context.requestId,
        providerId: context.event.pathParameters?.id
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve certification roadmaps'
      );
    }
  }

  /**
   * Phase 7: Get study path recommendations based on user preferences
   * POST /v1/providers/{id}/recommendations/study-paths
   */
  private async getStudyPathRecommendations(context: HandlerContext): Promise<ApiResponse> {
    try {
      const providerId = context.event.pathParameters?.id;
      
      if (!providerId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Provider ID is required'
        );
      }

      if (!context.event.body) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body with user preferences is required'
        );
      }

      this.logger.info('Getting study path recommendations', { 
        requestId: context.requestId,
        providerId
      });

      let body;
      try {
        body = JSON.parse(context.event.body);
      } catch (parseError) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON in request body'
        );
      }

      if (!body.userPreferences) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'userPreferences is required in request body'
        );
      }

      const request: GetStudyPathRecommendationsRequest = {
        providerId,
        userPreferences: this.validateUserPreferences(body.userPreferences),
        includeAlternativeProviders: body.includeAlternativeProviders || false
      };

      const providerService = this.serviceFactory.getProviderService();
      const result = await providerService.getStudyPathRecommendations(request);

      this.logger.info('Study path recommendations retrieved successfully', { 
        requestId: context.requestId,
        providerId,
        recommendationsCount: result.recommendations.length
      });

      return this.success(result, 'Study path recommendations retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get study path recommendations', error, { 
        requestId: context.requestId,
        providerId: context.event.pathParameters?.id
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve study path recommendations'
      );
    }
  }

  /**
   * Phase 7: Get provider resources and learning materials
   * GET /v1/providers/{id}/resources?certificationId=aws-saa-c03&category=training_material&type=video_course&isFree=true&maxCost=100&language=English&limit=20&offset=0
   */
  private async getProviderResources(context: HandlerContext): Promise<ApiResponse> {
    try {
      const providerId = context.event.pathParameters?.id;
      
      if (!providerId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Provider ID is required'
        );
      }

      this.logger.info('Getting provider resources', { 
        requestId: context.requestId,
        providerId,
        queryParams: context.event.queryStringParameters
      });

      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetProviderResourcesRequest = {
        providerId
      };
      
      // Only set optional properties if they have values
      if (queryParams.certificationId) {
        request.certificationId = queryParams.certificationId;
      }
      
      const category = this.parseEnumParam(queryParams.category, ResourceCategory);
      if (category) {
        request.category = category;
      }
      
      const type = this.parseEnumParam(queryParams.type, ResourceType);
      if (type) {
        request.type = type;
      }
      
      if (queryParams.isFree === 'true') {
        request.isFree = true;
      } else if (queryParams.isFree === 'false') {
        request.isFree = false;
      }
      
      if (queryParams.maxCost) {
        request.maxCost = parseInt(queryParams.maxCost, 10);
      }
      
      if (queryParams.language) {
        request.language = queryParams.language;
      }
      
      if (queryParams.limit) {
        request.limit = parseInt(queryParams.limit, 10);
      }
      
      if (queryParams.offset) {
        request.offset = parseInt(queryParams.offset, 10);
      }

      // Validate numeric parameters
      if (queryParams.maxCost && isNaN(request.maxCost!)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'maxCost must be a valid number'
        );
      }

      if (queryParams.limit && (isNaN(request.limit!) || request.limit! < 1 || request.limit! > 100)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'limit must be between 1 and 100'
        );
      }

      if (queryParams.offset && (isNaN(request.offset!) || request.offset! < 0)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'offset must be 0 or greater'
        );
      }

      const providerService = this.serviceFactory.getProviderService();
      const result = await providerService.getProviderResources(request);

      this.logger.info('Provider resources retrieved successfully', { 
        requestId: context.requestId,
        providerId,
        total: result.total,
        returned: result.resources.length
      });

      return this.success(result, 'Provider resources retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get provider resources', error, { 
        requestId: context.requestId,
        providerId: context.event.pathParameters?.id
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve provider resources'
      );
    }
  }

  /**
   * Phase 7: Get personalized recommendations across providers
   * POST /v1/providers/recommendations/personalized
   */
  private async getPersonalizedRecommendations(context: HandlerContext): Promise<ApiResponse> {
    try {
      if (!context.event.body) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body with user preferences is required'
        );
      }

      this.logger.info('Getting personalized recommendations', { 
        requestId: context.requestId
      });

      let body;
      try {
        body = JSON.parse(context.event.body);
      } catch (parseError) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON in request body'
        );
      }

      if (!body.userPreferences) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'userPreferences is required in request body'
        );
      }

      const request: GetPersonalizedRecommendationsRequest = {
        providerId: body.providerId, // Optional - if specified, recommendations for specific provider
        userPreferences: this.validateUserPreferences(body.userPreferences),
        maxRecommendations: body.maxRecommendations || 10
      };

      const providerService = this.serviceFactory.getProviderService();
      const result = await providerService.getPersonalizedRecommendations(request);

      this.logger.info('Personalized recommendations retrieved successfully', { 
        requestId: context.requestId,
        studyPathsCount: result.studyPaths.length,
        certificationPrioritiesCount: result.certificationPriorities.length,
        resourcesCount: result.recommendedResources.length
      });

      return this.success(result, 'Personalized recommendations retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get personalized recommendations', error, { 
        requestId: context.requestId
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve personalized recommendations'
      );
    }
  }

  /**
   * Validate and sanitize user learning preferences
   */
  private validateUserPreferences(preferences: any): UserLearningPreferences {
    if (!preferences || typeof preferences !== 'object') {
      throw new Error('Invalid user preferences format');
    }

    // Validate required fields
    if (!preferences.careerGoals || !Array.isArray(preferences.careerGoals)) {
      throw new Error('careerGoals must be a non-empty array');
    }

    if (!preferences.experienceLevel || !Object.values(ExperienceLevel).includes(preferences.experienceLevel)) {
      throw new Error('experienceLevel must be a valid experience level');
    }

    if (!preferences.timeCommitmentWeekly || typeof preferences.timeCommitmentWeekly !== 'number' || preferences.timeCommitmentWeekly <= 0) {
      throw new Error('timeCommitmentWeekly must be a positive number');
    }

    // Validate learning styles if provided
    if (preferences.learningStyle && Array.isArray(preferences.learningStyle)) {
      const validStyles = Object.values(LearningStyle);
      const invalidStyles = preferences.learningStyle.filter((style: string) => !validStyles.includes(style as LearningStyle));
      if (invalidStyles.length > 0) {
        throw new Error(`Invalid learning styles: ${invalidStyles.join(', ')}`);
      }
    }

    // Return sanitized preferences
    return {
      careerGoals: preferences.careerGoals || [],
      experienceLevel: preferences.experienceLevel,
      timeCommitmentWeekly: preferences.timeCommitmentWeekly,
      budgetLimit: preferences.budgetLimit || undefined,
      preferredProviders: preferences.preferredProviders || [],
      avoidedProviders: preferences.avoidedProviders || [],
      learningStyle: preferences.learningStyle || [],
      industryFocus: preferences.industryFocus || [],
      currentSkills: preferences.currentSkills || [],
      targetSkills: preferences.targetSkills || [],
      timeframe: preferences.timeframe || 'flexible'
    };
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