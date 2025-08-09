import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

// Core recommendation handler - focused on business logic only
const recommendationHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
  console.log(`[RECOMMENDATION] Handling ${route} for user ${userId}`);
  
  switch (route) {
    case 'GET /api/v1/recommendations':
      return await handleGetRecommendations(event, userId);
    
    default:
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(recommendationHandler);

async function handleGetRecommendations(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  const { queryStringParameters } = extractRequestInfo(event);
  console.log(`[RECOMMENDATION] Getting recommendations for user ${userId}`);
  
  // Simplified recommendations response based on the API documentation
  const response = {
    performance: {
      overallAccuracy: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      readinessScore: 0,
      readinessLevel: 'Beginner',
    },
    weakTopics: [],
    strongTopics: [],
    recommendations: [
      {
        type: 'study_frequency',
        priority: 'medium',
        title: 'Increase Study Frequency',
        description: 'Regular practice is key to retention and improvement',
        action: 'Aim for at least 3-4 study sessions per week',
      },
    ],
    studyPlan: [
      {
        week: 1,
        focus: 'Foundation Building',
        activities: [
          'Review basic concepts and terminology',
          'Practice 20-30 easy questions daily',
          'Study explanations thoroughly for incorrect answers',
        ],
        target: 'Achieve 70% accuracy on easy questions',
      },
    ],
    suggestedQuestions: [],
    metrics: {
      sessionsAnalyzed: 1,
      topicsIdentified: 0,
      lastStudyDate: new Date().toISOString(),
    },
  };

  return ResponseBuilder.success(response);
}