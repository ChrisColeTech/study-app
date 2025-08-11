// Question handler for Study App V3 Backend
// Phase 12: Question Listing Feature

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  GetQuestionsRequest,
  GetQuestionRequest,
  SearchQuestionsRequest,
  SearchSortOption,
  QuestionDifficulty,
  QuestionType 
} from '../shared/types/question.types';

export class QuestionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'QuestionHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // Get questions with filtering endpoint
      {
        method: 'GET',
        path: '/v1/questions',
        handler: this.getQuestions.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Get individual question details endpoint (Phase 13)
      {
        method: 'GET',
        path: '/v1/questions/{id}',
        handler: this.getQuestion.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Search questions endpoint (Phase 14)
      {
        method: 'POST',
        path: '/v1/questions/search',
        handler: this.searchQuestions.bind(this),
        requireAuth: false, // Public endpoint for now
      }
    ];
  }

  /**
   * Get questions with comprehensive filtering
   * GET /v1/questions?provider=aws&exam=saa-c03&topic=ec2&difficulty=intermediate&type=multiple_choice&search=instance&limit=20&offset=0&includeExplanations=true&includeMetadata=false
   */
  private async getQuestions(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Getting questions', { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetQuestionsRequest = {};
      
      // Provider filter
      if (queryParams.provider) {
        request.provider = decodeURIComponent(queryParams.provider);
      }
      
      // Exam filter
      if (queryParams.exam) {
        request.exam = decodeURIComponent(queryParams.exam);
      }
      
      // Topic filter
      if (queryParams.topic) {
        request.topic = decodeURIComponent(queryParams.topic);
      }
      
      // Difficulty filter
      if (queryParams.difficulty) {
        const difficulty = this.parseEnumParam(queryParams.difficulty, QuestionDifficulty);
        if (difficulty) {
          request.difficulty = difficulty;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid difficulty. Valid options: ${Object.values(QuestionDifficulty).join(', ')}`
          );
        }
      }
      
      // Type filter
      if (queryParams.type) {
        const type = this.parseEnumParam(queryParams.type, QuestionType);
        if (type) {
          request.type = type;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid type. Valid options: ${Object.values(QuestionType).join(', ')}`
          );
        }
      }
      
      // Tags filter (comma-separated)
      if (queryParams.tags) {
        request.tags = decodeURIComponent(queryParams.tags).split(',').map(tag => tag.trim());
      }
      
      // Search filter
      if (queryParams.search) {
        request.search = decodeURIComponent(queryParams.search);
      }
      
      // Pagination parameters
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
      
      // Include flags
      request.includeExplanations = queryParams.includeExplanations === 'true';
      request.includeMetadata = queryParams.includeMetadata === 'true';

      // Validate provider format if provided
      if (request.provider && !/^[a-zA-Z0-9_-]+$/.test(request.provider)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid provider format. Use alphanumeric characters, hyphens, and underscores only'
        );
      }

      // Validate exam format if provided
      if (request.exam && !/^[a-zA-Z0-9_-]+$/.test(request.exam)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid exam format. Use alphanumeric characters, hyphens, and underscores only'
        );
      }

      // Validate topic format if provided
      if (request.topic && !/^[a-zA-Z0-9_-]+$/.test(request.topic)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid topic format. Use alphanumeric characters, hyphens, and underscores only'
        );
      }

      // Validate search length
      if (request.search && request.search.length > 200) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Search term too long. Maximum 200 characters'
        );
      }

      // Get questions from service
      const questionService = this.serviceFactory.getQuestionService();
      const result = await questionService.getQuestions(request);

      this.logger.info('Questions retrieved successfully', { 
        requestId: context.requestId,
        total: result.total,
        returned: result.questions.length,
        filters: {
          provider: request.provider,
          exam: request.exam,
          topic: request.topic,
          difficulty: request.difficulty,
          type: request.type,
          search: request.search,
          tags: request.tags
        }
      });

      return this.success(result, 'Questions retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get questions', error, { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      // Handle specific error types
      if (error.message.includes('not found') || error.message.includes('NoSuchKey')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          'Questions not found for the specified criteria'
        );
      }

      if (error.message.includes('Invalid') || error.message.includes('validation')) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve questions'
      );
    }
  }

  /**
   * Get individual question by ID
   * Phase 13: Question Details Feature
   * GET /v1/questions/{id}?includeExplanation=true&includeMetadata=true
   */
  private async getQuestion(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Getting question by ID', { 
        requestId: context.requestId,
        pathParameters: context.event.pathParameters,
        queryParams: context.event.queryStringParameters
      });

      // Get question ID from path parameters
      const questionId = context.event.pathParameters?.id;
      if (!questionId) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Question ID is required'
        );
      }

      // Validate question ID format
      if (!/^[a-zA-Z0-9_-]+$/.test(questionId)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid question ID format. Use alphanumeric characters, hyphens, and underscores only'
        );
      }

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetQuestionRequest = {
        questionId,
        // Default to true for explanation and metadata on details endpoint
        includeExplanation: queryParams.includeExplanation !== 'false',
        includeMetadata: queryParams.includeMetadata !== 'false'
      };

      // Get question from service
      const questionService = this.serviceFactory.getQuestionService();
      const result = await questionService.getQuestion(request);

      this.logger.info('Question retrieved successfully', { 
        requestId: context.requestId,
        questionId: result.question.questionId,
        providerId: result.question.providerId,
        examId: result.question.examId
      });

      return this.success(result, 'Question retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get question', error, { 
        requestId: context.requestId,
        pathParameters: context.event.pathParameters
      });

      // Handle specific error types
      if (error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          'Question not found'
        );
      }

      if (error.message.includes('Invalid') || error.message.includes('validation')) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve question'
      );
    }
  }

  /**
   * Search questions with full-text search and relevance scoring
   * Phase 14: Question Search Feature
   * POST /v1/questions/search
   */
  private async searchQuestions(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Searching questions', { 
        requestId: context.requestId,
        hasBody: !!context.event.body
      });

      // Parse and validate request body
      if (!context.event.body) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body is required for search'
        );
      }

      let requestBody: any;
      try {
        requestBody = JSON.parse(context.event.body);
      } catch (error) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON in request body'
        );
      }

      // Validate required fields
      if (!requestBody.query || typeof requestBody.query !== 'string') {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Query is required and must be a string'
        );
      }

      // Build search request
      const request: SearchQuestionsRequest = {
        query: requestBody.query.trim()
      };

      // Validate query length
      if (request.query.length === 0) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Query cannot be empty'
        );
      }

      if (request.query.length > 200) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Query too long. Maximum 200 characters'
        );
      }

      // Optional filters
      if (requestBody.provider) {
        if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.provider)) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid provider format. Use alphanumeric characters, hyphens, and underscores only'
          );
        }
        request.provider = requestBody.provider;
      }

      if (requestBody.exam) {
        if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.exam)) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid exam format. Use alphanumeric characters, hyphens, and underscores only'
          );
        }
        request.exam = requestBody.exam;
      }

      if (requestBody.topic) {
        if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.topic)) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid topic format. Use alphanumeric characters, hyphens, and underscores only'
          );
        }
        request.topic = requestBody.topic;
      }

      // Difficulty filter
      if (requestBody.difficulty) {
        const difficulty = this.parseEnumParam(requestBody.difficulty, QuestionDifficulty);
        if (difficulty) {
          request.difficulty = difficulty;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid difficulty. Valid options: ${Object.values(QuestionDifficulty).join(', ')}`
          );
        }
      }

      // Type filter
      if (requestBody.type) {
        const type = this.parseEnumParam(requestBody.type, QuestionType);
        if (type) {
          request.type = type;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid type. Valid options: ${Object.values(QuestionType).join(', ')}`
          );
        }
      }

      // Tags filter
      if (requestBody.tags) {
        if (Array.isArray(requestBody.tags)) {
          request.tags = requestBody.tags.filter((tag: any) => 
            typeof tag === 'string' && tag.trim().length > 0
          );
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Tags must be an array of strings'
          );
        }
      }

      // Sort option
      if (requestBody.sortBy) {
        const sortBy = this.parseEnumParam(requestBody.sortBy, SearchSortOption);
        if (sortBy) {
          request.sortBy = sortBy;
        } else {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            `Invalid sortBy option. Valid options: ${Object.values(SearchSortOption).join(', ')}`
          );
        }
      }

      // Pagination parameters
      if (requestBody.limit !== undefined) {
        const limit = parseInt(requestBody.limit, 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Limit must be a number between 1 and 100'
          );
        }
        request.limit = limit;
      }

      if (requestBody.offset !== undefined) {
        const offset = parseInt(requestBody.offset, 10);
        if (isNaN(offset) || offset < 0) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Offset must be a non-negative number'
          );
        }
        request.offset = offset;
      }

      // Include flags
      request.includeExplanations = requestBody.includeExplanations === true;
      request.includeMetadata = requestBody.includeMetadata === true;
      request.highlightMatches = requestBody.highlightMatches === true;

      // Perform search
      const questionService = this.serviceFactory.getQuestionService();
      const result = await questionService.searchQuestions(request);

      this.logger.info('Questions searched successfully', { 
        requestId: context.requestId,
        query: result.query,
        total: result.total,
        returned: result.questions.length,
        searchTime: result.searchTime,
        averageScore: result.questions.length > 0 
          ? result.questions.reduce((sum, q) => sum + q.relevanceScore, 0) / result.questions.length 
          : 0
      });

      return this.success(result, 'Questions searched successfully');

    } catch (error: any) {
      this.logger.error('Failed to search questions', error, { 
        requestId: context.requestId,
        hasBody: !!context.event.body
      });

      // Handle specific error types
      if (error.message.includes('not found') || error.message.includes('NoSuchKey')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          'No questions found matching the search criteria'
        );
      }

      if (error.message.includes('Invalid') || error.message.includes('validation')) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to search questions'
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
const questionHandler = new QuestionHandler();
export const handler = questionHandler.handle;