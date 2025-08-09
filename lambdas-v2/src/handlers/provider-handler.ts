import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { Provider } from '../types';

/**
 * Provider Handler V2 - Demonstrates the new base handler pattern
 * 
 * Compare this to V1 where every handler had 15+ lines of duplicate auth code.
 * Now it's just clean business logic with zero boilerplate!
 */
class ProviderHandler extends BaseHandler {
  constructor() {
    super('ProviderHandler');
  }

  /**
   * Get all providers and their exams
   */
  private async getProviders(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    this.logger.info('Fetching providers for user', { userId });

    // Mock data - in real implementation, this would come from database/S3
    const providers: Provider[] = [
      {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Cloud computing platform and services',
        exams: [
          {
            id: 'saa-c03',
            name: 'Solutions Architect Associate',
            description: 'Validates ability to design distributed systems on AWS',
            questionCount: 681,
            duration: 130,
            passingScore: 720
          },
          {
            id: 'dva-c01',
            name: 'Developer Associate',
            description: 'Validates ability to develop applications on AWS',
            questionCount: 0,
            duration: 130,
            passingScore: 720
          },
          {
            id: 'soa-c02',
            name: 'SysOps Administrator Associate',
            description: 'Validates ability to deploy and manage systems on AWS',
            questionCount: 0,
            duration: 130,
            passingScore: 720
          }
        ]
      },
      {
        id: 'azure',
        name: 'Microsoft Azure',
        description: 'Cloud computing platform and services',
        exams: [
          {
            id: 'az-900',
            name: 'Azure Fundamentals',
            description: 'Validates foundational knowledge of cloud services',
            questionCount: 0,
            duration: 60,
            passingScore: 700
          },
          {
            id: 'az-104',
            name: 'Azure Administrator',
            description: 'Validates skills to manage Azure subscriptions and resources',
            questionCount: 0,
            duration: 150,
            passingScore: 700
          },
          {
            id: 'az-204',
            name: 'Azure Developer',
            description: 'Validates skills to develop cloud solutions',
            questionCount: 0,
            duration: 150,
            passingScore: 700
          }
        ]
      },
      {
        id: 'gcp',
        name: 'Google Cloud Platform',
        description: 'Cloud computing platform and services',
        exams: [
          {
            id: 'ace',
            name: 'Associate Cloud Engineer',
            description: 'Validates ability to deploy and manage GCP resources',
            questionCount: 0,
            duration: 120,
            passingScore: 70
          },
          {
            id: 'pca',
            name: 'Professional Cloud Architect',
            description: 'Validates ability to design and manage GCP solutions',
            questionCount: 0,
            duration: 120,
            passingScore: 70
          }
        ]
      }
    ];

    const totalProviders = providers.length;
    const totalExams = providers.reduce((sum, provider) => sum + provider.exams.length, 0);

    return this.success({
      providers,
      totalProviders,
      totalExams
    }, 'Providers retrieved successfully');
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

    // Mock data lookup - would query database in real implementation
    const allProviders: Provider[] = []; // Simplified for now
    const provider = allProviders.find(p => p.id === providerId);

    if (!provider) {
      return this.notFound(`Provider '${providerId}' not found`);
    }

    return this.success(provider, `Provider '${providerId}' retrieved successfully`);
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

  private badRequest(message: string): APIGatewayProxyResult {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message })
    };
  }

  private notFound(message: string): APIGatewayProxyResult {
    return {
      statusCode: 404,
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