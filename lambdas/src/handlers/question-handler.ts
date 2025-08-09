import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { QuestionService } from '../services/question-service';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

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

// Core question handler - focused on business logic only
const questionHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
  console.log(`[QUESTION] Handling ${route} for user ${userId}`);
  
  switch (route) {
    case 'GET /api/v1/questions':
      return await handleGetQuestions(event, userId);
    
    case 'POST /api/v1/questions/search':
      return await handleSearchQuestions(event, userId);
    
    case 'GET /api/v1/questions/{questionId}':
      return await handleGetQuestion(event, userId);
    
    default:
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(questionHandler);

async function handleGetQuestions(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { queryStringParameters } = extractRequestInfo(event);
  console.log(`[QUESTION] Getting questions for user ${userId}`);
  
  const queryParams: any = queryStringParameters;
  
  // Parse topics if it's a comma-separated string
  if (queryParams.topics && typeof queryParams.topics === 'string') {
    queryParams.topics = queryParams.topics.split(',');
  }
  
  // Convert numeric strings
  if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit);
  if (queryParams.offset) queryParams.offset = parseInt(queryParams.offset);
  
  const { error, value } = questionsQuerySchema.validate(queryParams);
  if (error) {
    return ResponseBuilder.validation(error.details[0].message);
  }
  
  const result = await questionService.getQuestions(value);
  return ResponseBuilder.success(result);
}

async function handleSearchQuestions(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { body } = extractRequestInfo(event);
  console.log(`[QUESTION] Searching questions for user ${userId}`);
  
  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }
  
  const { error, value } = searchSchema.validate(body);
  if (error) {
    return ResponseBuilder.validation(error.details[0].message);
  }
  
  const result = await questionService.searchQuestions(value);
  return ResponseBuilder.success(result);
}

async function handleGetQuestion(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters, queryStringParameters } = extractRequestInfo(event);
  const questionId = pathParameters.questionId;
  
  if (!questionId) {
    return ResponseBuilder.validation('Question ID is required');
  }
  
  const provider = queryStringParameters.provider || 'aws';
  const exam = queryStringParameters.exam || 'saa-c03';
  
  console.log(`[QUESTION] Getting question ${questionId} (${provider}/${exam}) for user ${userId}`);
  
  const question = await questionService.getQuestionById(provider, exam, questionId);
  
  if (!question) {
    return ResponseBuilder.notFound('Question not found');
  }
  
  return ResponseBuilder.success({ question });
}