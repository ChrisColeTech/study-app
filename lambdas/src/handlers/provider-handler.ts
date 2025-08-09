import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ProviderService } from '../services/provider-service';
import { ResponseBuilder } from '../shared/response-builder';

const providerService = new ProviderService();

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
    console.log('Request context:', JSON.stringify(event.requestContext, null, 2));
    console.log('Authorizer data:', JSON.stringify(event.requestContext.authorizer, null, 2));
    
    // Check authorization
    const userId = event.requestContext.authorizer?.userId;
    console.log('Extracted userId:', userId);
    
    if (!userId) {
      return ResponseBuilder.unauthorized('User not authenticated');
    }

    switch (`${httpMethod} ${resource}`) {
      case 'GET /api/v1/providers':
        return await handleGetProviders(event);
      
      case 'GET /api/v1/providers/{providerId}':
        return await handleGetProvider(event);
      
      case 'GET /api/v1/providers/{providerId}/exams':
        return await handleGetProviderExams(event);
      
      default:
        return ResponseBuilder.notFound('Route not found');
    }
  } catch (error) {
    console.error('Provider handler error:', error);
    return ResponseBuilder.error(
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};

async function handleGetProviders(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const result = await providerService.getProviders();
    return ResponseBuilder.success(result);
  } catch (error) {
    throw error;
  }
}

async function handleGetProvider(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const providerId = event.pathParameters?.providerId;
    if (!providerId) {
      return ResponseBuilder.validation('Provider ID is required');
    }

    const provider = await providerService.getProvider(providerId);
    
    if (!provider) {
      return ResponseBuilder.notFound('Provider not found');
    }

    return ResponseBuilder.success({ provider });
  } catch (error) {
    throw error;
  }
}

async function handleGetProviderExams(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const providerId = event.pathParameters?.providerId;
    if (!providerId) {
      return ResponseBuilder.validation('Provider ID is required');
    }

    const exams = await providerService.getProviderExams(providerId);
    return ResponseBuilder.success({ exams });
  } catch (error) {
    throw error;
  }
}