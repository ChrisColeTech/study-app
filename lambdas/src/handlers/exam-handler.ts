import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ExamService } from '../services/exam-service';
import { ResponseBuilder } from '../shared/response-builder';

const examService = new ExamService();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource, pathParameters, queryStringParameters } = event;
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return ResponseBuilder.unauthorized('User not authenticated');
    }

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
    }

    switch (`${httpMethod} ${resource}`) {
      case 'GET /api/v1/exams':
        return await handleGetAllExams(event);
      
      case 'GET /api/v1/exams/{examId}':
        return await handleGetExamById(event);
      
      case 'GET /api/v1/exams/{examId}/topics':
        return await handleGetExamTopics(event);
      
      default:
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Exam handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleGetAllExams(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const provider = queryParams.provider;

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
  } catch (error) {
    throw error;
  }
}

async function handleGetExamById(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const examId = event.pathParameters?.examId;
    if (!examId) {
      return ResponseBuilder.validation('Exam ID is required');
    }

    const queryParams = event.queryStringParameters || {};
    const providerId = queryParams.provider;

    const result = await examService.getExamById(examId, providerId);
    
    if (!result) {
      return ResponseBuilder.notFound('Exam not found');
    }

    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}

async function handleGetExamTopics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const examId = event.pathParameters?.examId;
    if (!examId) {
      return ResponseBuilder.validation('Exam ID is required');
    }

    const queryParams = event.queryStringParameters || {};
    const providerId = queryParams.provider;

    const result = await examService.getExamTopics(examId, providerId);
    
    if (!result) {
      return ResponseBuilder.notFound('Exam topics not found');
    }

    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}