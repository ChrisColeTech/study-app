// Exam handler for Study App V3 Backend
// Phase 8: Exam Listing Feature

import { BaseHandler } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { GetExamsRequest } from '../shared/types/exam.types';

export class ExamHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'ExamHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // Get all exams endpoint
      {
        method: 'GET',
        path: '/v1/exams',
        handler: this.getExams.bind(this),
        requireAuth: false, // Public endpoint for now
      }
    ];
  }

  /**
   * Get all exams with optional filtering
   * GET /v1/exams?provider=aws&level=associate&search=solutions&includeInactive=false&limit=50&offset=0
   */
  private async getExams(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Getting all exams', { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetExamsRequest = {};
      
      // Provider filter
      if (queryParams.provider) {
        request.provider = decodeURIComponent(queryParams.provider);
      }
      
      // Category filter
      if (queryParams.category) {
        request.category = decodeURIComponent(queryParams.category);
      }
      
      // Level filter
      if (queryParams.level) {
        const level = decodeURIComponent(queryParams.level).toLowerCase();
        const validLevels = ['foundational', 'associate', 'professional', 'specialty', 'expert'];
        
        if (validLevels.includes(level)) {
          request.level = level;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid level. Valid options: ${validLevels.join(', ')}`
          );
        }
      }
      
      // Search filter
      if (queryParams.search) {
        request.search = decodeURIComponent(queryParams.search);
      }
      
      // Include inactive filter
      if (queryParams.includeInactive === 'true') {
        request.includeInactive = true;
      }

      // Pagination
      if (queryParams.limit) {
        const limit = parseInt(queryParams.limit, 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Limit must be a number between 1 and 100'
          );
        }
        request.limit = limit;
      }

      if (queryParams.offset) {
        const offset = parseInt(queryParams.offset, 10);
        if (isNaN(offset) || offset < 0) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Offset must be a non-negative number'
          );
        }
        request.offset = offset;
      }

      // Get exams from service
      const examService = this.serviceFactory.getExamService();
      const result = await examService.getExams(request);

      this.logger.info('Exams retrieved successfully', { 
        requestId: context.requestId,
        total: result.total,
        returned: result.exams.length,
        filters: {
          provider: request.provider,
          category: request.category,
          level: request.level,
          search: request.search,
          includeInactive: request.includeInactive
        },
        pagination: result.pagination
      });

      return this.success(result, 'Exams retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get exams', error, { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve exams'
      );
    }
  }
}

// Export handler function for Lambda
const examHandler = new ExamHandler();
export const handler = examHandler.handle;