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
   * Get provider's exams
   */
  private async getProviderExams(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const providerId = this.getPathParam(event, 'providerId');
    
    if (!providerId) {
      return this.badRequest('Provider ID is required');
    }

    this.logger.info('Fetching provider exams', { userId, providerId });

    try {
      const provider = await this.providerService.getProvider(providerId);

      if (!provider) {
        return this.notFound(`Provider '${providerId}' not found`);
      }

      return this.success(provider.exams || [], `Exams for provider '${providerId}' retrieved successfully`);

    } catch (error) {
      this.logger.error('Failed to fetch provider exams', { userId, providerId, error });
      return this.internalError('Failed to retrieve provider exams');
    }
  }

  /**
   * Get all exams across all providers (TEMPORARY - until exam handler deployment is fixed)
   */
  private async getAllExams(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    this.logger.info('Fetching all exams', { userId });

    try {
      const providers = await this.providerService.getAllProviders();
      const allExams = providers.flatMap(provider => 
        provider.exams?.map(exam => ({
          ...exam,
          provider: {
            id: provider.id,
            name: provider.name
          }
        })) || []
      );

      return this.success(allExams, 'All exams retrieved successfully');

    } catch (error) {
      this.logger.error('Failed to fetch all exams', { userId, error });
      return this.internalError('Failed to retrieve exams');
    }
  }

  /**
   * Get specific exam by ID (TEMPORARY - until exam handler deployment is fixed)
   */
  private async getExam(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const examId = this.getPathParam(event, 'examId');
    
    if (!examId) {
      return this.badRequest('Exam ID is required');
    }

    this.logger.info('Fetching specific exam', { userId, examId });

    try {
      const providers = await this.providerService.getAllProviders();
      
      for (const provider of providers) {
        const exam = provider.exams?.find(e => e.id === examId);
        if (exam) {
          return this.success({
            ...exam,
            provider: {
              id: provider.id,
              name: provider.name
            }
          }, `Exam '${examId}' retrieved successfully`);
        }
      }

      return this.notFound(`Exam '${examId}' not found`);

    } catch (error) {
      this.logger.error('Failed to fetch specific exam', { userId, examId, error });
      return this.internalError('Failed to retrieve exam');
    }
  }

  /**
   * Get exam topics by exam ID (TEMPORARY - until exam handler deployment is fixed)
   */
  private async getExamTopics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const examId = this.getPathParam(event, 'examId');
    
    if (!examId) {
      return this.badRequest('Exam ID is required');
    }

    this.logger.info('Fetching exam topics', { userId, examId });

    try {
      // For now, return placeholder topics - this would normally come from question analysis
      const topics = [
        { id: 'compute', name: 'Compute Services', questionCount: 120 },
        { id: 'storage', name: 'Storage Services', questionCount: 85 },
        { id: 'networking', name: 'Networking & VPC', questionCount: 95 },
        { id: 'databases', name: 'Database Services', questionCount: 75 },
        { id: 'security', name: 'Security & Identity', questionCount: 110 },
        { id: 'monitoring', name: 'Monitoring & Management', questionCount: 65 }
      ];

      return this.success(topics, `Topics for exam '${examId}' retrieved successfully`);

    } catch (error) {
      this.logger.error('Failed to fetch exam topics', { userId, examId, error });
      return this.internalError('Failed to retrieve exam topics');
    }
  }

  /**
   * Route handler - determines which method to call
   * 
   * TEMPORARILY handles both provider AND exam routes until exam handler deployment is fixed:
   * - GET /providers - All providers
   * - GET /providers/{providerId} - Specific provider  
   * - GET /providers/{providerId}/exams - Provider's exams
   * - GET /exams - All exams (TEMPORARY)
   * - GET /exams/{examId} - Specific exam (TEMPORARY)
   * - GET /exams/{examId}/topics - Exam topics (TEMPORARY)
   */
  public async handleRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod, resource } = event;
    const providerId = this.getPathParam(event, 'providerId');
    const examId = this.getPathParam(event, 'examId');

    if (httpMethod !== 'GET') {
      return this.methodNotAllowed(`${httpMethod} method not supported`);
    }

    try {
      // TEMPORARY: Handle exam routes until exam handler deployment is fixed
      if (resource.includes('/exams/{examId}/topics')) {
        return this.getExamTopics(event, userId);
      } else if (resource.includes('/exams/{examId}')) {
        return this.getExam(event, userId);
      } else if (resource.includes('/exams')) {
        return this.getAllExams(event, userId);
      }
      
      // Provider routes (original functionality)
      if (resource.includes('/providers/{providerId}/exams')) {
        return this.getProviderExams(event, userId);
      } else if (providerId) {
        return this.getProvider(event, userId);
      } else {
        return this.getProviders(event, userId);
      }
    } catch (error) {
      this.logger.error('Route handling failed', { resource, httpMethod, userId, error });
      return this.internalError('Request processing failed');
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