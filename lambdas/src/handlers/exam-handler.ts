import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExamService } from '../services/exam-service';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

const examService = new ExamService();

// Core exam handler - focused on business logic only
const examHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
  console.log(`[EXAM] Handling ${route} for user ${userId}`);
  
  switch (route) {
    case 'GET /api/v1/exams':
      return await handleGetAllExams(event, userId);
    
    case 'GET /api/v1/exams/{examId}':
      return await handleGetExamById(event, userId);
    
    case 'GET /api/v1/exams/{examId}/topics':
      return await handleGetExamTopics(event, userId);
    
    default:
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(examHandler);

async function handleGetAllExams(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { queryStringParameters } = extractRequestInfo(event);
  console.log(`[EXAM] Getting all exams for user ${userId}`);
  
  const provider = queryStringParameters.provider;

  if (provider) {
    // Get exams for specific provider
    const result = await examService.getExamsByProvider(provider);
    if (!result) {
      return ResponseBuilder.notFound('Provider not found');
    }
    return ResponseBuilder.success(result);
  } else {
    // Get all exams across providers
    const result = await examService.getAllExams();
    return ResponseBuilder.success(result);
  }
}

async function handleGetExamById(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters, queryStringParameters } = extractRequestInfo(event);
  const examId = pathParameters.examId;
  
  if (!examId) {
    return ResponseBuilder.validation('Exam ID is required');
  }

  const providerId = queryStringParameters.provider;
  console.log(`[EXAM] Getting exam ${examId} (provider: ${providerId}) for user ${userId}`);

  const result = await examService.getExamById(examId, providerId);
  
  if (!result) {
    return ResponseBuilder.notFound('Exam not found');
  }

  return ResponseBuilder.success(result);
}

async function handleGetExamTopics(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters, queryStringParameters } = extractRequestInfo(event);
  const examId = pathParameters.examId;
  
  if (!examId) {
    return ResponseBuilder.validation('Exam ID is required');
  }

  const providerId = queryStringParameters.provider;
  console.log(`[EXAM] Getting topics for exam ${examId} (provider: ${providerId}) for user ${userId}`);

  const result = await examService.getExamTopics(examId, providerId);
  
  if (!result) {
    return ResponseBuilder.notFound('Exam topics not found');
  }

  return ResponseBuilder.success(result);
}