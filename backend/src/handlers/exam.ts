// Refactored Exam handler using middleware pattern
// Eliminates architecture violations: repetitive validation patterns, mixed parsing/business logic

import { BaseHandler } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { GetExamsRequest, GetExamRequest } from '../shared/types/exam.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  CommonParsing
} from '../shared/middleware';

export class ExamHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'ExamHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'GET',
        path: '/v1/exams',
        handler: this.getExams.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/exams/{id}',
        handler: this.getExam.bind(this),
        requireAuth: false,
      }
    ];
  }

  /**
   * Get all exams with optional filtering - now clean and focused
   */
  private async getExams(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters using middleware
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context, {
      provider: { type: 'string', decode: true },
      category: { type: 'string', decode: true },
      level: { type: 'string', decode: true },
      search: CommonParsing.search,
      includeInactive: CommonParsing.booleanFlag,
      ...CommonParsing.pagination
    });
    if (parseError) return parseError;

    // Validate level enum if provided
    if (queryParams.level) {
      const validLevels = ['foundational', 'associate', 'professional', 'specialty', 'expert'];
      if (!validLevels.includes(queryParams.level.toLowerCase())) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid level. Valid options: ${validLevels.join(', ')}`
        );
      }
    }

    // Build request object
    const request: GetExamsRequest = {
      ...(queryParams.provider && { provider: queryParams.provider }),
      ...(queryParams.category && { category: queryParams.category }),
      ...(queryParams.level && { level: queryParams.level.toLowerCase() }),
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.includeInactive && { includeInactive: queryParams.includeInactive }),
      ...(queryParams.limit && { limit: queryParams.limit }),
      ...(queryParams.offset && { offset: queryParams.offset })
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const examService = this.serviceFactory.getExamService();
        return await examService.getExams(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Exam.LIST,
        additionalInfo: { filters: request }
      }
    );

    if (error) return error;

    this.logger.info('Exams retrieved successfully', { 
      requestId: context.requestId,
      total: result!.total,
      returned: result!.exams.length,
      filters: request,
      pagination: result!.pagination
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Exams retrieved successfully');
  }

  /**
   * Get a specific exam by ID - now clean and focused
   */
  private async getExam(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate path parameters
    if (!pathParams.id) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Exam ID is required'
      );
    }

    // Parse query parameters
    const { data: queryParams } = ParsingMiddleware.parseQueryParams(context, {
      includeProvider: CommonParsing.booleanFlag
    });

    // Build request object
    const request: GetExamRequest = {
      ...(queryParams?.includeProvider && { includeProvider: queryParams.includeProvider })
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const examService = this.serviceFactory.getExamService();
        return await examService.getExam(pathParams.id, request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Exam.GET,
        additionalInfo: { examId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Exam retrieved successfully', { 
      requestId: context.requestId,
      examId: pathParams.id,
      examName: result!.exam.examName,
      providerId: result!.exam.providerId,
      includeProvider: request.includeProvider
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Exam retrieved successfully');
  }
}

// Export handler function for Lambda
const examHandler = new ExamHandler();
export const handler = examHandler.handle;