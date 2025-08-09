import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ProviderService } from '../services/provider-service';
import { ResponseBuilder } from '../shared/response-builder';
import { withAuth, extractRequestInfo } from '../shared/auth-middleware';

const providerService = new ProviderService();

// Core provider handler - now focused only on business logic
const providerHandler = async (
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> => {
  const { route } = extractRequestInfo(event);
  
  console.log(`[PROVIDER] Handling ${route} for user ${userId}`);
  
  switch (route) {
    case 'GET /api/v1/providers':
      return await handleGetProviders(event, userId);
    
    case 'GET /api/v1/providers/{providerId}':
      return await handleGetProvider(event, userId);
    
    case 'GET /api/v1/providers/{providerId}/exams':
      return await handleGetProviderExams(event, userId);
    
    default:
      return ResponseBuilder.notFound('Route not found');
  }
};

// Export the handler wrapped with authentication middleware
export const handler = withAuth(providerHandler);

async function handleGetProviders(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  console.log(`[PROVIDER] Getting all providers for user ${userId}`);
  const result = await providerService.getProviders();
  return ResponseBuilder.success(result);
}

async function handleGetProvider(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const providerId = pathParameters.providerId;
  
  if (!providerId) {
    return ResponseBuilder.validation('Provider ID is required');
  }

  console.log(`[PROVIDER] Getting provider ${providerId} for user ${userId}`);
  const provider = await providerService.getProvider(providerId);
  
  if (!provider) {
    return ResponseBuilder.notFound('Provider not found');
  }

  return ResponseBuilder.success({ provider });
}

async function handleGetProviderExams(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const { pathParameters } = extractRequestInfo(event);
  const providerId = pathParameters.providerId;
  
  if (!providerId) {
    return ResponseBuilder.validation('Provider ID is required');
  }

  console.log(`[PROVIDER] Getting exams for provider ${providerId} for user ${userId}`);
  const exams = await providerService.getProviderExams(providerId);
  return ResponseBuilder.success({ exams });
}