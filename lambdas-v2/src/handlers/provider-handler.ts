import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { Provider } from '../types';
import { ProviderService } from '../services/provider-service';

/**
 * Provider Handler V2 - Demonstrates the new base handler pattern
 * 
 * Compare this to V1 where every handler had 15+ lines of duplicate auth code.
 * Now it's just clean business logic with zero boilerplate!
 */
class ProviderHandler extends BaseHandler {
  private providerService: ProviderService;

  constructor() {
    super('ProviderHandler');
    this.providerService = new ProviderService();
  }

  /**
   * Get all providers and their exams
   */
  private async getProviders(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    this.logger.info('Fetching providers for user', { userId });

    try {
      const providers = await this.providerService.getAllProviders();
      const stats = await this.providerService.getProviderStats();

      return this.success({
        providers,
        totalProviders: stats.totalProviders,
        totalExams: stats.totalExams,
        providerBreakdown: stats.providerBreakdown
      }, 'Providers retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch providers', { userId, error });
      return this.internalError('Failed to retrieve providers');
    }
  }

  /**
   * Get specific provider by ID
   */
  private async getProvider(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const providerId = this.getPathParam(event, 'providerId');
    
    if (!providerId) {
      return this.badRequest('Provider ID is required');
    }

    this.logger.info('Fetching specific provider', { userId, providerId });

    try {
      const provider = await this.providerService.getProvider(providerId);

      if (!provider) {
        return this.notFound(`Provider '${providerId}' not found`);
      }

      return this.success(provider, `Provider '${providerId}' retrieved successfully`);

    } catch (error) {
      this.logger.error('Failed to fetch specific provider', { userId, providerId, error });
      return this.internalError('Failed to retrieve provider');
    }
  }

  /**
   * Route handler - determines which method to call
   */
  public async handleRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod } = event;
    const providerId = this.getPathParam(event, 'providerId');

    switch (httpMethod) {
      case 'GET':
        return providerId ? 
          this.getProvider(event, userId) : 
          this.getProviders(event, userId);
      
      default:
        return this.methodNotAllowed(`${httpMethod} method not supported`);
    }
  }

  private methodNotAllowed(message: string): APIGatewayProxyResult {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message })
    };
  }
}

// Export the handler with authentication middleware
const providerHandler = new ProviderHandler();
export const handler = providerHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => providerHandler.handleRequest(event, userId)
);