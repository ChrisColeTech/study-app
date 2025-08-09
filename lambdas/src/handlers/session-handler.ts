import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { SessionService } from '../services/session-service';
import { ResponseBuilder } from '../shared/response-builder';

const sessionService = new SessionService();

const sessionCreateSchema = Joi.object({
  provider: Joi.string().required(),
  exam: Joi.string().required(),
  questionCount: Joi.number().integer().min(1).max(100).required(),
});

const answerSchema = Joi.object({
  questionId: Joi.string().required(),
  answer: Joi.string().required(),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource, pathParameters } = event;
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return ResponseBuilder.unauthorized('User not authenticated');
    }

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
    }

    switch (`${httpMethod} ${resource}`) {
      case 'POST /api/v1/sessions':
        return await handleCreateSession(event, userId);
      
      case 'GET /api/v1/sessions':
        return await handleGetUserSessions(event, userId);
      
      case 'GET /api/v1/sessions/{sessionId}':
        return await handleGetSession(event, userId);
      
      case 'PUT /api/v1/sessions/{sessionId}':
        return await handleUpdateSession(event, userId);
      
      case 'DELETE /api/v1/sessions/{sessionId}':
        return await handleDeleteSession(event, userId);
      
      case 'POST /api/v1/sessions/{sessionId}/answers':
        return await handleSubmitAnswer(event, userId);
      
      case 'POST /api/v1/sessions/adaptive':
        return await handleCreateAdaptiveSession(event, userId);
      
      default:
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Session handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleCreateSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = sessionCreateSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const session = await sessionService.createSession(userId, value);
    return ResponseBuilder.success({ session });
  } catch (error) {
    throw error;
  }
}

async function handleGetUserSessions(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit || '10');

    const sessions = await sessionService.getUserSessions(userId, limit);
    return ResponseBuilder.success({ sessions, total: sessions.length });
  } catch (error) {
    throw error;
  }
}

async function handleGetSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return ResponseBuilder.validation('Session ID is required');
    }

    const session = await sessionService.getSession(sessionId, userId);
    
    if (!session) {
      return ResponseBuilder.notFound('Session not found');
    }

    return ResponseBuilder.success({ session });
  } catch (error) {
    throw error;
  }
}

async function handleUpdateSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return ResponseBuilder.validation('Session ID is required');
    }

    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const updates = JSON.parse(event.body);
    const updatedSession = await sessionService.updateSession(sessionId, userId, updates);
    
    if (!updatedSession) {
      return ResponseBuilder.notFound('Session not found');
    }

    return ResponseBuilder.success({ session: updatedSession });
  } catch (error) {
    throw error;
  }
}

async function handleDeleteSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return ResponseBuilder.validation('Session ID is required');
    }

    const deleted = await sessionService.deleteSession(sessionId, userId);
    
    if (!deleted) {
      return ResponseBuilder.notFound('Session not found');
    }

    return ResponseBuilder.success({ message: 'Session deleted successfully' });
  } catch (error) {
    throw error;
  }
}

async function handleSubmitAnswer(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return ResponseBuilder.validation('Session ID is required');
    }

    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = answerSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const result = await sessionService.submitAnswer(sessionId, userId, value);
    return ResponseBuilder.success(result);
  } catch (error) {
    if (error instanceof Error && 
        (error.message === 'Session not found' || error.message === 'Session is already completed')) {
      return ResponseBuilder.validation(error.message);
    }
    throw error;
  }
}

async function handleCreateAdaptiveSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return ResponseBuilder.validation('Request body is required');
    }

    const body = JSON.parse(event.body);
    const { error, value } = sessionCreateSchema.validate(body);

    if (error) {
      return ResponseBuilder.validation(error.details[0].message);
    }

    const result = await sessionService.createAdaptiveSession(userId, value);
    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}