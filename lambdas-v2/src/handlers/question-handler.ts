import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { GetQuestionsRequest, QuestionFilter, PaginationOptions } from '../types';
import { QuestionService } from '../services/question-service';

/**
 * Question Handler V2 - Study question management with S3 backend
 * Supports filtering, search, and pagination
 */
class QuestionHandler extends BaseHandler {
  private questionService: QuestionService;

  constructor() {
    super('QuestionHandler');
    this.questionService = new QuestionService();
  }

  /**
   * Get questions with filtering, search, and pagination
   */
  public async getQuestions(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    this.logger.info('Fetching questions for user', { userId });

    try {
      // Extract query parameters
      const provider = this.getQueryParam(event, 'provider') || 'aws';
      const exam = this.getQueryParam(event, 'exam') || 'saa-c03';
      const limit = parseInt(this.getQueryParam(event, 'limit', '50') || '50', 10);
      const offset = parseInt(this.getQueryParam(event, 'offset', '0') || '0', 10);
      
      // Build filters
      const filter: QuestionFilter = {};
      
      if (this.getQueryParam(event, 'difficulty')) {
        filter.difficulty = this.getQueryParam(event, 'difficulty') as any;
      }
      
      if (this.getQueryParam(event, 'topics')) {
        filter.topics = this.getQueryParam(event, 'topics')?.split(',') || [];
      }
      
      if (this.getQueryParam(event, 'serviceCategory')) {
        filter.serviceCategory = this.getQueryParam(event, 'serviceCategory');
      }
      
      if (this.getQueryParam(event, 'awsServices')) {
        filter.awsServices = this.getQueryParam(event, 'awsServices')?.split(',') || [];
      }
      
      if (this.getQueryParam(event, 'search')) {
        filter.search = this.getQueryParam(event, 'search');
      }
      
      if (this.getQueryParam(event, 'hasExplanation')) {
        filter.hasExplanation = this.getQueryParam(event, 'hasExplanation') === 'true';
      }
      
      if (this.getQueryParam(event, 'questionType')) {
        filter.questionType = this.getQueryParam(event, 'questionType') as any;
      }

      // Build pagination
      const pagination: PaginationOptions = { limit, offset };

      // Get questions
      const result = await this.questionService.getQuestions(provider, exam, filter, pagination);

      this.logger.info('Questions fetched successfully', {
        userId,
        provider,
        exam,
        totalCount: result.totalCount,
        returnedCount: result.questions.length
      });

      return this.success(result, 'Questions retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch questions', { userId, error });
      return this.internalError('Failed to retrieve questions');
    }
  }

  /**
   * Get a specific question
   */
  public async getQuestion(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const questionId = this.getPathParam(event, 'questionId');
    
    if (!questionId) {
      return this.badRequest('Question ID is required');
    }

    try {
      const provider = this.getQueryParam(event, 'provider') || 'aws';
      const exam = this.getQueryParam(event, 'exam') || 'saa-c03';

      const question = await this.questionService.getQuestion(provider, exam, questionId);

      if (!question) {
        return this.notFound(`Question '${questionId}' not found`);
      }

      return this.success(question, 'Question retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch specific question', { userId, questionId, error });
      return this.internalError('Failed to retrieve question');
    }
  }

  /**
   * Get random questions for practice
   */
  public async getRandomQuestions(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const provider = this.getQueryParam(event, 'provider') || 'aws';
      const exam = this.getQueryParam(event, 'exam') || 'saa-c03';
      const count = parseInt(this.getQueryParam(event, 'count', '20') || '20', 10);

      // Build filters for random selection
      const filter: QuestionFilter = {};
      
      if (this.getQueryParam(event, 'difficulty')) {
        filter.difficulty = this.getQueryParam(event, 'difficulty') as any;
      }
      
      if (this.getQueryParam(event, 'topics')) {
        filter.topics = this.getQueryParam(event, 'topics')?.split(',') || [];
      }
      
      if (this.getQueryParam(event, 'hasExplanation')) {
        filter.hasExplanation = this.getQueryParam(event, 'hasExplanation') === 'true';
      }

      const questions = await this.questionService.getRandomQuestions(provider, exam, count, filter);

      return this.success({
        questions,
        count: questions.length,
        requested: count
      }, 'Random questions retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch random questions', { userId, error });
      return this.internalError('Failed to retrieve random questions');
    }
  }

  /**
   * Get question statistics
   */
  public async getQuestionStats(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const provider = this.getQueryParam(event, 'provider') || 'aws';
      const exam = this.getQueryParam(event, 'exam') || 'saa-c03';

      const stats = await this.questionService.getQuestionStats(provider, exam);

      return this.success(stats, 'Question statistics retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch question stats', { userId, error });
      return this.internalError('Failed to retrieve question statistics');
    }
  }

  /**
   * Route handler - determines which method to call
   */
  public async handleRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod } = event;
    const questionId = this.getPathParam(event, 'questionId');
    const resource = event.resource;

    switch (httpMethod) {
      case 'GET':
        if (resource.includes('/random')) {
          return this.getRandomQuestions(event, userId);
        } else if (resource.includes('/stats')) {
          return this.getQuestionStats(event, userId);
        } else if (questionId) {
          return this.getQuestion(event, userId);
        } else {
          return this.getQuestions(event, userId);
        }
      
      default:
        return this.methodNotAllowed(`${httpMethod} method not supported`);
    }
  }

  private methodNotAllowed(message: string): APIGatewayProxyResult {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message })
    };
  }
}

const questionHandler = new QuestionHandler();
export const handler = questionHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => questionHandler.handleRequest(event, userId)
);