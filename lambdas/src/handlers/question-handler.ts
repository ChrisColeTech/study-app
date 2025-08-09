import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { QuestionService } from '../services/question-service';
import { ResponseBuilder } from '../shared/response-builder';

const questionService = new QuestionService();

const questionsQuerySchema = Joi.object({
  provider: Joi.string().optional(),
  exam: Joi.string().optional(),
  topics: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

const searchSchema = Joi.object({
  query: Joi.string().min(1).required(),
  provider: Joi.string().optional(),
  exam: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource, pathParameters } = event;

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
    }

    // Debug: Log request context to see what authorizer data is available
    console.log('Question handler - Request context:', JSON.stringify(event.requestContext, null, 2));
    console.log('Question handler - Authorizer data:', JSON.stringify(event.requestContext.authorizer, null, 2));
    
    // Check authorization
    const userId = event.requestContext.authorizer?.userId;
    console.log('Question handler - Extracted userId:', userId);
    
    if (!userId) {
      return ResponseBuilder.unauthorized('User not authenticated');
    }

    switch (`${httpMethod} ${resource}`) {
      case 'GET /api/v1/questions':
        return await handleGetQuestions(event);
      
      case 'POST /api/v1/questions/search':
        return await handleSearchQuestions(event);
      
      case 'GET /api/v1/questions/{questionId}':
        return await handleGetQuestion(event);
      
      default:
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Question handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleGetQuestions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const queryParams: any = event.queryStringParameters || {};
    
    // Parse topics if it's a comma-separated string
    if (queryParams.topics && typeof queryParams.topics === 'string') {
      queryParams.topics = queryParams.topics.split(',');
    }

    // Convert numeric strings
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit as string);
    if (queryParams.offset) queryParams.offset = parseInt(queryParams.offset as string);

    const { error, value } = questionsQuerySchema.validate(queryParams);
    
    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const result = await questionService.getQuestions(value);
    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}

async function handleSearchQuestions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = searchSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const result = await questionService.searchQuestions(value);
    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}

async function handleGetQuestion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const questionId = event.pathParameters?.questionId;
    if (!questionId) {
      return ResponseBuilder.validation('Question ID is required');
    }

    const queryParams = event.queryStringParameters || {};
    const provider = queryParams.provider || 'aws';
    const exam = queryParams.exam || 'saa-c03';

    const question = await questionService.getQuestionById(provider, exam, questionId);
    
    if (!question) {
      return ResponseBuilder.notFound('Question not found');
    }

    return ResponseBuilder.success({ question });
  } catch (error) {
    throw error;
  }
}