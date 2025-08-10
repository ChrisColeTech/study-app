import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { ProviderService } from '../services/provider-service';

/**
 * Exam Handler - Dedicated handler for exam-related endpoints
 * 
 * Handles:
 * - GET /exams - All exams across providers
 * - GET /exams/{examId} - Specific exam details
 * - GET /exams/{examId}/topics - Exam topics
 * 
 * Proper separation of concerns: Exams are a separate business domain
 */
class ExamHandler extends BaseHandler {
  private providerService: ProviderService;

  constructor() {
    super('ExamHandler');
    this.providerService = new ProviderService();
  }

  /**
   * Get all exams across all providers
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
   * Get specific exam by ID
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
        if (!provider.exams) continue;
        
        const exam = provider.exams.find(e => e.id === examId);
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
   * Get exam topics
   */
  private async getExamTopics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const examId = this.getPathParam(event, 'examId');
    
    if (!examId) {
      return this.badRequest('Exam ID is required');
    }

    this.logger.info('Fetching exam topics', { userId, examId });

    try {
      // First verify exam exists
      const providers = await this.providerService.getAllProviders();
      let examExists = false;
      
      for (const provider of providers) {
        if (provider.exams?.find(e => e.id === examId)) {
          examExists = true;
          break;
        }
      }

      if (!examExists) {
        return this.notFound(`Exam '${examId}' not found`);
      }

      // Return AWS-specific topics for now - could be enhanced with provider-specific topics
      const topics = [
        'Identity and Access Management (IAM)',
        'Compute Services (EC2, Lambda)',
        'Storage Services (S3, EBS)',
        'Database Services (RDS, DynamoDB)',
        'Networking (VPC, CloudFront)',
        'Security and Compliance',
        'Monitoring and Logging (CloudWatch)',
        'Cost Optimization'
      ];

      return this.success(topics, `Topics for exam '${examId}' retrieved successfully`);

    } catch (error) {
      this.logger.error('Failed to fetch exam topics', { userId, examId, error });
      return this.internalError('Failed to retrieve exam topics');
    }
  }

  /**
   * Route handler - determines which method to call
   */
  public async handleRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod, resource } = event;
    const examId = this.getPathParam(event, 'examId');

    if (httpMethod !== 'GET') {
      return this.methodNotAllowed(`${httpMethod} method not supported`);
    }

    try {
      // Route based on the resource path pattern
      if (resource.includes('/exams/{examId}/topics')) {
        return this.getExamTopics(event, userId);
      } else if (examId) {
        return this.getExam(event, userId);
      } else {
        return this.getAllExams(event, userId);
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
const examHandler = new ExamHandler();
export const handler = examHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => examHandler.handleRequest(event, userId)
);