import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { SessionService } from '../services/session-service';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

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

// Core session handler - focused on business logic only
const sessionHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
  console.log(`[SESSION] Handling ${route} for user ${userId}`);
  
  switch (route) {
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
    
    case 'POST /api/v1/sessions/{sessionId}/complete':
      return await handleCompleteSession(event, userId);
    
    default:
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(sessionHandler);

async function handleCreateSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { body } = extractRequestInfo(event);
  console.log(`[SESSION] Creating session for user ${userId}`);
  
  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }

  const { error, value } = sessionCreateSchema.validate(body);

  if (error) {
    return ResponseBuilder.validation(error.details[0].message);
  }

  const session = await sessionService.createSession(userId, value);
  console.log(`[SESSION] Created session ${session.sessionId} for user ${userId}`);
  return ResponseBuilder.success({ session });
}

async function handleGetUserSessions(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { queryStringParameters } = extractRequestInfo(event);
  console.log(`[SESSION] Getting sessions for user ${userId}`);
  
  const limit = parseInt(queryStringParameters.limit || '10');

  const sessions = await sessionService.getUserSessions(userId, limit);
  console.log(`[SESSION] Retrieved ${sessions.length} sessions for user ${userId}`);
  return ResponseBuilder.success({ sessions, total: sessions.length });
}

async function handleGetSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const sessionId = pathParameters.sessionId;
  
  if (!sessionId) {
    return ResponseBuilder.validation('Session ID is required');
  }

  console.log(`[SESSION] Getting session ${sessionId} for user ${userId}`);
  const session = await sessionService.getSession(sessionId, userId);
  
  if (!session) {
    return ResponseBuilder.notFound('Session not found');
  }

  return ResponseBuilder.success({ session });
}

async function handleUpdateSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters, body } = extractRequestInfo(event);
  const sessionId = pathParameters.sessionId;
  
  if (!sessionId) {
    return ResponseBuilder.validation('Session ID is required');
  }

  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }

  console.log(`[SESSION] Updating session ${sessionId} for user ${userId}`);
  const updatedSession = await sessionService.updateSession(sessionId, userId, body);
  
  if (!updatedSession) {
    return ResponseBuilder.notFound('Session not found');
  }

  return ResponseBuilder.success({ session: updatedSession });
}

async function handleDeleteSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const sessionId = pathParameters.sessionId;
  
  if (!sessionId) {
    return ResponseBuilder.validation('Session ID is required');
  }

  console.log(`[SESSION] Deleting session ${sessionId} for user ${userId}`);
  const deleted = await sessionService.deleteSession(sessionId, userId);
  
  if (!deleted) {
    return ResponseBuilder.notFound('Session not found');
  }

  console.log(`[SESSION] Deleted session ${sessionId} for user ${userId}`);
  return ResponseBuilder.success({ message: 'Session deleted successfully' });
}

async function handleSubmitAnswer(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters, body } = extractRequestInfo(event);
  const sessionId = pathParameters.sessionId;
  
  if (!sessionId) {
    return ResponseBuilder.validation('Session ID is required');
  }

  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }

  const { error, value } = answerSchema.validate(body);

  if (error) {
    return ResponseBuilder.validation(error.details[0].message);
  }

  console.log(`[SESSION] Submitting answer for session ${sessionId}, question ${value.questionId}, user ${userId}`);
  
  try {
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
  const { body } = extractRequestInfo(event);
  console.log(`[SESSION] Creating adaptive session for user ${userId}`);
  
  if (!body) {
    return ResponseBuilder.validation('Request body is required');
  }

  const { error, value } = sessionCreateSchema.validate(body);

  if (error) {
    return ResponseBuilder.validation(error.details[0].message);
  }

  const result = await sessionService.createAdaptiveSession(userId, value);
  console.log(`[SESSION] Created adaptive session for user ${userId}`);
  return ResponseBuilder.success(result);
}

async function handleCompleteSession(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const sessionId = pathParameters.sessionId;
  
  if (!sessionId) {
    return ResponseBuilder.validation('Session ID is required');
  }

  console.log(`[SESSION] Completing session ${sessionId} for user ${userId}`);
  const completedSession = await sessionService.completeSession(sessionId, userId);
  
  if (!completedSession) {
    return ResponseBuilder.notFound('Session not found');
  }

  // Get session statistics for the response
  const stats = await sessionService.getSessionStats(sessionId, userId);
  console.log(`[SESSION] Completed session ${sessionId} for user ${userId}`);

  return ResponseBuilder.success({ 
    session: completedSession,
    statistics: stats,
  });
}