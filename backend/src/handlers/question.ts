// Refactored Question handler using middleware pattern
// Eliminates architecture violations: excessive validation/parsing boilerplate, mixed concerns

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  GetQuestionsRequest,
  GetQuestionRequest,
  SearchQuestionsRequest,
  QuestionDifficulty,
  QuestionType,
  SearchSortOption
} from '../shared/types/question.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  CommonParsing,
  AuthMiddleware,
  AuthConfigs
} from '../shared/middleware';

export class QuestionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'QuestionHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'GET',
        path: '/v1/questions',
        handler: this.getQuestions.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/questions/{id}',
        handler: this.getQuestion.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/questions/search',
        handler: this.searchQuestions.bind(this),
        requireAuth: false,
      }
    ];
  }

  /**
   * Get questions with comprehensive filtering - now clean and focused
   */
  private async getQuestions(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters using middleware
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context, {
      provider: CommonParsing.alphanumericId,
      exam: CommonParsing.alphanumericId,
      topic: CommonParsing.alphanumericId,
      difficulty: { type: 'string', decode: true },
      type: { type: 'string', decode: true },
      tags: CommonParsing.csvArray,
      search: CommonParsing.search,
      includeExplanations: CommonParsing.booleanFlag,
      includeMetadata: CommonParsing.booleanFlag,
      ...CommonParsing.pagination
    });
    if (parseError) return parseError;

    // Validate enums if provided using helper method
    const enumValidationError = this.validateEnumParams(queryParams);
    if (enumValidationError) return enumValidationError;

    // Build request object
    const request: GetQuestionsRequest = {
      ...(queryParams.provider && { provider: queryParams.provider }),
      ...(queryParams.exam && { exam: queryParams.exam }),
      ...(queryParams.topic && { topic: queryParams.topic }),
      ...(queryParams.difficulty && { difficulty: queryParams.difficulty as QuestionDifficulty }),
      ...(queryParams.type && { type: queryParams.type as QuestionType }),
      ...(queryParams.tags && { tags: queryParams.tags }),
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.limit && { limit: queryParams.limit }),
      ...(queryParams.offset && { offset: queryParams.offset }),
      includeExplanations: queryParams.includeExplanations === true,
      includeMetadata: queryParams.includeMetadata === true
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const questionService = this.serviceFactory.getQuestionService();
        return await questionService.getQuestions(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Question.LIST,
        additionalInfo: { filters: request }
      }
    );

    if (error) return error;

    this.logger.info('Questions retrieved successfully', { 
      requestId: context.requestId,
      total: result!.total,
      returned: result!.questions.length,
      filters: request
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Questions retrieved successfully');
  }

  /**
   * Get individual question by ID - now clean and focused
   */
  private async getQuestion(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate question ID
    if (!pathParams.id) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Question ID is required'
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(pathParams.id)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid question ID format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    // Parse query parameters
    const { data: queryParams } = ParsingMiddleware.parseQueryParams(context, {
      includeExplanation: CommonParsing.booleanFlag,
      includeMetadata: CommonParsing.booleanFlag
    });

    // Build request object
    const request: GetQuestionRequest = {
      questionId: pathParams.id,
      includeExplanation: queryParams?.includeExplanation !== false, // Default to true
      includeMetadata: queryParams?.includeMetadata !== false // Default to true
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const questionService = this.serviceFactory.getQuestionService();
        return await questionService.getQuestion(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Question.GET,
        additionalInfo: { questionId: request.questionId }
      }
    );

    if (error) return error;

    this.logger.info('Question retrieved successfully', { 
      requestId: context.requestId,
      questionId: result!.question.questionId,
      providerId: result!.question.providerId,
      examId: result!.question.examId
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Question retrieved successfully');
  }

  /**
   * Search questions with full-text search - now clean and focused
   */
  private async searchQuestions(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<SearchQuestionsRequest>(context, true);
    if (parseError) return parseError;

    // Validate required query field
    if (!requestBody.query || typeof requestBody.query !== 'string' || requestBody.query.trim().length === 0) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Query is required and must be a non-empty string'
      );
    }

    if (requestBody.query.length > 200) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Query too long. Maximum 200 characters'
      );
    }

    // Validate optional fields using helper method
    const validationError = this.validateSearchRequest(requestBody);
    if (validationError) return validationError;

    // Build search request
    const request: SearchQuestionsRequest = {
      query: requestBody.query.trim(),
      ...(requestBody.provider && { provider: requestBody.provider }),
      ...(requestBody.exam && { exam: requestBody.exam }),
      ...(requestBody.topic && { topic: requestBody.topic }),
      ...(requestBody.difficulty && { difficulty: requestBody.difficulty }),
      ...(requestBody.type && { type: requestBody.type }),
      ...(requestBody.tags && { tags: requestBody.tags }),
      ...(requestBody.sortBy && { sortBy: requestBody.sortBy }),
      ...(requestBody.limit && { limit: requestBody.limit }),
      ...(requestBody.offset && { offset: requestBody.offset }),
      includeExplanations: requestBody.includeExplanations === true,
      includeMetadata: requestBody.includeMetadata === true,
      highlightMatches: requestBody.highlightMatches === true
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const questionService = this.serviceFactory.getQuestionService();
        return await questionService.searchQuestions(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Question.SEARCH,
        additionalInfo: { query: request.query }
      }
    );

    if (error) return error;

    this.logger.info('Questions searched successfully', { 
      requestId: context.requestId,
      query: result!.query,
      total: result!.total,
      returned: result!.questions.length,
      searchTime: result!.searchTime
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Questions searched successfully');
  }

  /**
   * Helper method to validate enum parameters - extracted from massive validation blocks
   */
  private validateEnumParams(queryParams: any): ApiResponse | null {
    if (queryParams.difficulty && !Object.values(QuestionDifficulty).includes(queryParams.difficulty as QuestionDifficulty)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid difficulty. Valid options: ${Object.values(QuestionDifficulty).join(', ')}`
      );
    }

    if (queryParams.type && !Object.values(QuestionType).includes(queryParams.type as QuestionType)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid type. Valid options: ${Object.values(QuestionType).join(', ')}`
      );
    }

    return null;
  }

  /**
   * Helper method to validate search request - extracted from massive validation blocks
   */
  private validateSearchRequest(requestBody: any): ApiResponse | null {
    // Validate provider format if provided
    if (requestBody.provider && !/^[a-zA-Z0-9_-]+$/.test(requestBody.provider)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid provider format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    // Validate exam format if provided
    if (requestBody.exam && !/^[a-zA-Z0-9_-]+$/.test(requestBody.exam)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid exam format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    // Validate difficulty enum
    if (requestBody.difficulty && !Object.values(QuestionDifficulty).includes(requestBody.difficulty)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid difficulty. Valid options: ${Object.values(QuestionDifficulty).join(', ')}`
      );
    }

    // Validate type enum
    if (requestBody.type && !Object.values(QuestionType).includes(requestBody.type)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid type. Valid options: ${Object.values(QuestionType).join(', ')}`
      );
    }

    // Validate sortBy enum
    if (requestBody.sortBy && !Object.values(SearchSortOption).includes(requestBody.sortBy)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid sortBy option. Valid options: ${Object.values(SearchSortOption).join(', ')}`
      );
    }

    // Validate tags array
    if (requestBody.tags) {
      if (!Array.isArray(requestBody.tags)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Tags must be an array of strings'
        );
      }

      const validTags = requestBody.tags.filter((tag: any) => 
        typeof tag === 'string' && tag.trim().length > 0
      );
      requestBody.tags = validTags; // Clean the tags
    }

    // Validate limit and offset
    if (requestBody.limit !== undefined) {
      const limit = parseInt(requestBody.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Limit must be a number between 1 and 100'
        );
      }
      requestBody.limit = limit;
    }

    if (requestBody.offset !== undefined) {
      const offset = parseInt(requestBody.offset, 10);
      if (isNaN(offset) || offset < 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Offset must be a non-negative number'
        );
      }
      requestBody.offset = offset;
    }

    return null;
  }
}

// Export handler function for Lambda
const questionHandler = new QuestionHandler();
export const handler = questionHandler.handle;