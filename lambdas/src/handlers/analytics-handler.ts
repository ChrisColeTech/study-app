import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

// Core analytics handler - focused on business logic only
const analyticsHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
  console.log(`[ANALYTICS] Handling ${route} for user ${userId}`);
  
  switch (route) {
    case 'GET /api/v1/analytics/progress':
      return await handleGetProgress(event, userId);
    
    case 'GET /api/v1/analytics/sessions/{sessionId}':
      return await handleGetSessionAnalytics(event, userId);
    
    case 'GET /api/v1/analytics/performance':
      return await handleGetPerformance(event, userId);
    
    default:
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(analyticsHandler);

async function handleGetProgress(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { queryStringParameters } = extractRequestInfo(event);
  console.log(`[ANALYTICS] Getting progress analytics for user ${userId}`);
  
  const timeRange = queryStringParameters.timeRange || 'month';
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  
  // Simplified analytics response
  const response = {
    overview: {
      totalSessions: 1,
      completedSessions: 0,
      completionRate: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      overallAccuracy: 0,
    },
    topicPerformance: [],
    progressTrend: [
      {
        date: new Date().toISOString().split('T')[0],
        sessions: 1,
        questions: 0,
        accuracy: 0,
      },
    ],
    strengths: [],
    weaknesses: [],
    filters: {
      provider: queryStringParameters.provider || 'aws',
      exam: queryStringParameters.exam || null,
      timeRange,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    },
  };

  return ResponseBuilder.success(response);
}

async function handleGetSessionAnalytics(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const sessionId = pathParameters.sessionId;
  
  if (!sessionId) {
    return ResponseBuilder.validation('Session ID is required');
  }

  console.log(`[ANALYTICS] Getting session analytics for session ${sessionId}, user ${userId}`);

  // Simplified session analytics
  const response = {
    sessionInfo: {
      sessionId,
      provider: 'aws',
      createdAt: new Date().toISOString(),
      duration: null,
      isCompleted: false,
    },
    performance: {
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracy: 0,
      averageTimePerQuestion: 0,
    },
    topicPerformance: [],
    difficultyPerformance: [],
    answerDistribution: {},
    questionAnalysis: [],
    insights: [
      'Consider reviewing fundamental concepts before attempting more questions.',
      'Consider spending more time analyzing questions thoroughly.',
    ],
  };

  return ResponseBuilder.success(response);
}

async function handleGetPerformance(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  console.log(`[ANALYTICS] Getting performance analytics for user ${userId}`);
  
  // Simplified performance analytics
  const response = {
    overall: {
      accuracy: 0,
      averageScore: 0,
      improvementRate: 0,
      studyStreak: 0,
    },
    byProvider: {},
    byTopic: {},
    trends: {
      accuracy: [],
      speed: [],
      difficulty: [],
    },
    recommendations: [],
  };

  return ResponseBuilder.success(response);
}