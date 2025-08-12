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
  ValidationMiddleware,
  AuthMiddleware,
  AuthConfigs
} from '../shared/middleware';
import { QuestionValidationSchemas } from '../shared/middleware/validation-schemas';

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

    // Validate enums if provided using ValidationMiddleware (replaces validateEnumParams)
    const enumValidation = ValidationMiddleware.validateFields(queryParams, QuestionValidationSchemas.enumParams(), 'query');
    if (enumValidation) return enumValidation;

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

    return this.buildSuccessResponse('Questions retrieved successfully', result);
  }

  /**
   * Get individual question by ID - now clean and focused
   */
  private async getQuestion(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate question ID using ValidationMiddleware (replaces inline validation)
    const questionIdValidation = ValidationMiddleware.validateFields({ questionId: pathParams.id }, QuestionValidationSchemas.questionId(), 'params');
    if (questionIdValidation) return questionIdValidation;

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

    return this.buildSuccessResponse('Question retrieved successfully', result);
  }

  /**
   * Search questions with full-text search - now clean and focused
   */
  private async searchQuestions(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<SearchQuestionsRequest>(context, true);
    if (parseError) return parseError;

    // Validate query field using ValidationMiddleware (replaces inline validation)
    const queryValidation = ValidationMiddleware.validateFields(requestBody, QuestionValidationSchemas.searchQueryRequest(), 'body');
    if (queryValidation) return queryValidation;

    // Validate optional fields using ValidationMiddleware (replaces validateSearchRequest)
    const searchValidation = ValidationMiddleware.validateFields(requestBody, QuestionValidationSchemas.searchRequest(), 'body');
    if (searchValidation) return searchValidation;

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

    return this.buildSuccessResponse('Questions searched successfully', result);
  }




}

// Export handler function for Lambda
const questionHandler = new QuestionHandler();
export const handler = questionHandler.handle;