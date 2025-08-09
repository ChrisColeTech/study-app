import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ResponseBuilder } from '../shared/response-builder';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, resource } = event;
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return ResponseBuilder.unauthorized('User not authenticated');
    }

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return ResponseBuilder.success('', 200);
    }

    if (httpMethod === 'GET' && resource === '/api/v1/recommendations') {
      return await handleGetRecommendations(event, userId);
    }

    return ResponseBuilder.notFound('Route not found');
  } catch (error) {
    console.error('Recommendation handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleGetRecommendations(
  event: APIGatewayProxyEvent, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    
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
  } catch (error) {
    throw error;
  }
}