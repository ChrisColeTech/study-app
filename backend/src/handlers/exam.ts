// Exam handler for Study App V3 Backend - Phase 8: Exam Listing Feature

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  ListExamsRequest,
  GetExamRequest,
  SearchExamsRequest,
  CompareExamsRequest,
  GetProviderExamsRequest,
  ExamSearchCriteria,
  ExamCategory,
  MarketDemand,
  SalaryImpact,
  ExamSortOption,
  SortOrder,
  ExamStatus,
  EXAM_ERROR_CODES
} from '../shared/types/exam.types';

import { CertificationLevel, ExamFormat } from '../shared/types/provider.types';

export class ExamHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'ExamHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // List all exams with filtering
      {
        method: 'GET',
        path: '/v1/exams',
        handler: this.listExams.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Get detailed exam information
      {
        method: 'GET',
        path: '/v1/exams/{id}',
        handler: this.getExam.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Search exams with advanced text search
      {
        method: 'GET',
        path: '/v1/exams/search',
        handler: this.searchExams.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Compare multiple exams
      {
        method: 'POST',
        path: '/v1/exams/compare',
        handler: this.compareExams.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Get exams for a specific provider
      {
        method: 'GET',
        path: '/v1/providers/{providerId}/exams',
        handler: this.getProviderExams.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Refresh exam cache
      {
        method: 'POST',
        path: '/v1/exams/cache/refresh',
        handler: this.refreshCache.bind(this),
        requireAuth: false, // Will require admin auth in future phases
      }
    ];
  }

  /**
   * List all exams with comprehensive filtering
   * GET /v1/exams?search=aws&providerId=aws&category=cloud&level=associate&difficulty=3&costMin=0&costMax=200&sortBy=difficulty&sortOrder=asc&limit=20&offset=0
   */
  private async listExams(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Listing exams', { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      const queryParams = context.event.queryStringParameters || {};
      
      // Build search criteria from query parameters
      const searchCriteria: ExamSearchCriteria = {};

      // Text search query
      if (queryParams.search) {
        searchCriteria.query = decodeURIComponent(queryParams.search);
      }

      // Provider filters
      if (queryParams.providerId) {
        searchCriteria.providerId = queryParams.providerId;
      }

      if (queryParams.providerIds) {
        searchCriteria.providerIds = queryParams.providerIds.split(',');
      }

      // Category filter
      if (queryParams.category) {
        const category = this.parseEnumParam(queryParams.category, ExamCategory);
        if (category) {
          searchCriteria.category = category;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid category. Valid options: ${Object.values(ExamCategory).join(', ')}`
          );
        }
      }

      // Level filter
      if (queryParams.level) {
        const level = this.parseEnumParam(queryParams.level, CertificationLevel);
        if (level) {
          searchCriteria.level = level;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid level. Valid options: ${Object.values(CertificationLevel).join(', ')}`
          );
        }
      }

      // Difficulty filter
      if (queryParams.difficultyMin || queryParams.difficultyMax) {
        const min = parseInt(queryParams.difficultyMin || '1', 10);
        const max = parseInt(queryParams.difficultyMax || '5', 10);
        
        if (isNaN(min) || isNaN(max) || min < 1 || max > 5 || min > max) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Difficulty range must be between 1-5 with min <= max'
          );
        }
        
        searchCriteria.difficulty = { min, max };
      }

      // Cost filter
      if (queryParams.costMin || queryParams.costMax) {
        const min = parseFloat(queryParams.costMin || '0');
        const max = parseFloat(queryParams.costMax || '9999');
        
        if (isNaN(min) || isNaN(max) || min < 0 || min > max) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Cost range must be positive numbers with min <= max'
          );
        }
        
        searchCriteria.costRange = { min, max };
      }

      // Duration filter
      if (queryParams.durationMin || queryParams.durationMax) {
        const min = parseInt(queryParams.durationMin || '0', 10);
        const max = parseInt(queryParams.durationMax || '999999', 10);
        
        if (isNaN(min) || isNaN(max) || min < 0 || min > max) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Duration range must be positive minutes with min <= max'
          );
        }
        
        searchCriteria.durationRange = { min, max };
      }

      // Language filter
      if (queryParams.languages) {
        searchCriteria.languages = queryParams.languages.split(',').map(l => l.trim());
      }

      // Market demand filter
      if (queryParams.marketDemand) {
        const demand = this.parseEnumParam(queryParams.marketDemand, MarketDemand);
        if (demand) {
          searchCriteria.marketDemand = demand;
        }
      }

      // Salary impact filter
      if (queryParams.salaryImpact) {
        const impact = this.parseEnumParam(queryParams.salaryImpact, SalaryImpact);
        if (impact) {
          searchCriteria.salaryImpact = impact;
        }
      }

      // Format filter
      if (queryParams.format) {
        const format = this.parseEnumParam(queryParams.format, ExamFormat);
        if (format) {
          searchCriteria.format = format;
        }
      }

      // Status filter
      if (queryParams.status) {
        const status = this.parseEnumParam(queryParams.status, ExamStatus);
        if (status) {
          searchCriteria.status = status;
        }
      }

      // Sorting
      if (queryParams.sortBy) {
        const sortBy = this.parseEnumParam(queryParams.sortBy, ExamSortOption);
        if (sortBy) {
          searchCriteria.sortBy = sortBy;
        }
      }

      if (queryParams.sortOrder) {
        const sortOrder = this.parseEnumParam(queryParams.sortOrder, SortOrder);
        if (sortOrder) {
          searchCriteria.sortOrder = sortOrder;
        }
      }

      // Pagination
      if (queryParams.limit) {
        const limit = parseInt(queryParams.limit, 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Limit must be between 1 and 100'
          );
        }
        searchCriteria.limit = limit;
      }

      if (queryParams.offset) {
        const offset = parseInt(queryParams.offset, 10);
        if (isNaN(offset) || offset < 0) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Offset must be 0 or greater'
          );
        }
        searchCriteria.offset = offset;
      }

      const request: ListExamsRequest = {
        search: searchCriteria,
        includeInactive: queryParams.includeInactive === 'true'
      };

      // Get exams from service
      const examService = this.serviceFactory.getExamService();
      const result = await examService.listExams(request);

      this.logger.info('Exams listed successfully', { 
        requestId: context.requestId,
        total: result.total,
        returned: result.exams.length,
        hasMore: result.pagination.hasMore
      });

      return this.success(result, 'Exams retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to list exams', error, { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve exams'
      );
    }
  }

  /**
   * Get detailed information about a specific exam
   * GET /v1/exams/{id}?includeQuestions=true&includeResources=true
   */
  private async getExam(context: HandlerContext): Promise<ApiResponse> {
    try {
      const examId = context.event.pathParameters?.id;
      
      if (!examId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Exam ID is required'
        );
      }

      // Validate exam ID format
      if (!/^[a-zA-Z0-9_-]+$/.test(examId)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid exam ID format'
        );
      }

      this.logger.info('Getting exam details', { 
        requestId: context.requestId,
        examId,
        queryParams: context.event.queryStringParameters
      });

      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetExamRequest = {
        id: examId,
        includeQuestions: queryParams.includeQuestions === 'true',
        includeResources: queryParams.includeResources !== 'false' // Default to true
      };

      const examService = this.serviceFactory.getExamService();
      const result = await examService.getExam(request);

      this.logger.info('Exam details retrieved successfully', { 
        requestId: context.requestId,
        examId: result.exam.id,
        examName: result.exam.name,
        similarCount: result.similarExams?.length || 0
      });

      return this.success(result, 'Exam details retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get exam details', error, { 
        requestId: context.requestId,
        examId: context.event.pathParameters?.id
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve exam details'
      );
    }
  }

  /**
   * Search exams with advanced text search
   * GET /v1/exams/search?q=cloud&fuzzy=true&category=cloud&limit=20
   */
  private async searchExams(context: HandlerContext): Promise<ApiResponse> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      
      if (!queryParams.q) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Search query parameter "q" is required'
        );
      }

      const query = decodeURIComponent(queryParams.q);

      this.logger.info('Searching exams', { 
        requestId: context.requestId,
        query,
        fuzzy: queryParams.fuzzy
      });

      // Build additional filters if provided
      const filters: ExamSearchCriteria = {};

      if (queryParams.category) {
        const category = this.parseEnumParam(queryParams.category, ExamCategory);
        if (category) {
          filters.category = category;
        }
      }

      if (queryParams.providerId) {
        filters.providerId = queryParams.providerId;
      }

      if (queryParams.level) {
        const level = this.parseEnumParam(queryParams.level, CertificationLevel);
        if (level) {
          filters.level = level;
        }
      }

      if (queryParams.limit) {
        const limit = parseInt(queryParams.limit, 10);
        if (!isNaN(limit) && limit > 0 && limit <= 100) {
          filters.limit = limit;
        }
      }

      const request: SearchExamsRequest = {
        query,
        fuzzySearch: queryParams.fuzzy === 'true'
      };

      if (Object.keys(filters).length > 0) {
        request.filters = filters;
      }

      const examService = this.serviceFactory.getExamService();
      const result = await examService.searchExams(request);

      this.logger.info('Exam search completed successfully', { 
        requestId: context.requestId,
        query,
        results: result.exams.length,
        searchTime: result.searchMetadata.searchTime
      });

      return this.success(result, 'Exam search completed successfully');

    } catch (error: any) {
      this.logger.error('Failed to search exams', error, { 
        requestId: context.requestId,
        query: context.event.queryStringParameters?.q
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to search exams'
      );
    }
  }

  /**
   * Compare multiple exams
   * POST /v1/exams/compare
   */
  private async compareExams(context: HandlerContext): Promise<ApiResponse> {
    try {
      if (!context.event.body) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body is required'
        );
      }

      this.logger.info('Comparing exams', { 
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

      if (!body.examIds || !Array.isArray(body.examIds)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'examIds must be provided as an array'
        );
      }

      if (body.examIds.length < 2) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'At least 2 exam IDs are required for comparison'
        );
      }

      if (body.examIds.length > 10) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Cannot compare more than 10 exams at once'
        );
      }

      // Validate exam IDs format
      for (const examId of body.examIds) {
        if (typeof examId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(examId)) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid exam ID format: ${examId}`
          );
        }
      }

      const request: CompareExamsRequest = {
        examIds: body.examIds,
        comparisonCriteria: body.comparisonCriteria
      };

      const examService = this.serviceFactory.getExamService();
      const result = await examService.compareExams(request);

      this.logger.info('Exam comparison completed successfully', { 
        requestId: context.requestId,
        examCount: body.examIds.length,
        bestOverall: result.comparison.recommendations.bestOverall
      });

      return this.success(result, 'Exam comparison completed successfully');

    } catch (error: any) {
      this.logger.error('Failed to compare exams', error, { 
        requestId: context.requestId
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      if (error.message.includes('At least 2 exams') || error.message.includes('Cannot compare more than')) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to compare exams'
      );
    }
  }

  /**
   * Get exams for a specific provider
   * GET /v1/providers/{providerId}/exams?category=cloud&level=associate
   */
  private async getProviderExams(context: HandlerContext): Promise<ApiResponse> {
    try {
      const providerId = context.event.pathParameters?.providerId;
      
      if (!providerId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Provider ID is required'
        );
      }

      // Validate provider ID format
      if (!/^[a-zA-Z0-9_-]+$/.test(providerId)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid provider ID format'
        );
      }

      this.logger.info('Getting provider exams', { 
        requestId: context.requestId,
        providerId,
        queryParams: context.event.queryStringParameters
      });

      const queryParams = context.event.queryStringParameters || {};
      
      // Build filters from query parameters
      const filters: ExamSearchCriteria = {};

      if (queryParams.category) {
        const category = this.parseEnumParam(queryParams.category, ExamCategory);
        if (category) {
          filters.category = category;
        }
      }

      if (queryParams.level) {
        const level = this.parseEnumParam(queryParams.level, CertificationLevel);
        if (level) {
          filters.level = level;
        }
      }

      if (queryParams.difficulty) {
        const difficulty = parseInt(queryParams.difficulty, 10);
        if (!isNaN(difficulty) && difficulty >= 1 && difficulty <= 5) {
          filters.difficulty = { min: difficulty, max: difficulty };
        }
      }

      const request: GetProviderExamsRequest = {
        providerId
      };

      if (Object.keys(filters).length > 0) {
        request.filters = filters;
      }

      const examService = this.serviceFactory.getExamService();
      const result = await examService.getProviderExams(request);

      this.logger.info('Provider exams retrieved successfully', { 
        requestId: context.requestId,
        providerId,
        total: result.total,
        pathsCount: result.certificationPaths.length
      });

      return this.success(result, 'Provider exams retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get provider exams', error, { 
        requestId: context.requestId,
        providerId: context.event.pathParameters?.providerId
      });

      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve provider exams'
      );
    }
  }

  /**
   * Refresh exam cache
   * POST /v1/exams/cache/refresh
   */
  private async refreshCache(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Refreshing exam cache', { 
        requestId: context.requestId
      });

      const examService = this.serviceFactory.getExamService();
      await examService.refreshExamCache();

      this.logger.info('Exam cache refreshed successfully', { 
        requestId: context.requestId
      });

      return this.success(
        { message: 'Exam cache refreshed successfully' }, 
        'Cache refreshed successfully'
      );

    } catch (error: any) {
      this.logger.error('Failed to refresh cache', error, { 
        requestId: context.requestId
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to refresh exam cache'
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
const examHandler = new ExamHandler();
export const handler = examHandler.handle;