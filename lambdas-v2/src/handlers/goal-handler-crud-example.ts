import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CrudHandler } from '../shared/crud-handler';
import { StudyGoal } from '../types';

/**
 * Goal Handler using CRUD base class - Shows how to implement full CRUD operations
 * 
 * This demonstrates how much boilerplate the CrudHandler eliminates:
 * - Automatic HTTP method routing
 * - Standard response formatting
 * - Validation helpers
 * - Error handling
 * - Just implement the 5 core methods!
 */
class GoalCrudHandler extends CrudHandler<StudyGoal> {
  constructor() {
    super('GoalCrudHandler', 'Goal');
  }

  protected async handleList(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Query parameters for filtering/pagination
    const status = this.getQueryParam(event, 'status');
    const limit = parseInt(this.getQueryParam(event, 'limit') || '10');
    const offset = parseInt(this.getQueryParam(event, 'offset') || '0');

    this.logger.info('Fetching goals', { userId, status, limit, offset });

    // Mock data - in real implementation, query DynamoDB
    const mockGoals: StudyGoal[] = [
      {
        goalId: 'goal-1',
        userId,
        title: 'Pass AWS SAA-C03',
        description: 'Complete AWS Solutions Architect Associate certification',
        targetDate: '2024-12-31',
        status: 'active',
        progress: 75,
        metrics: {
          questionsTarget: 1000,
          questionsCompleted: 750,
          accuracyTarget: 85,
          currentAccuracy: 82
        },
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-08-01T00:00:00Z'
      },
      {
        goalId: 'goal-2',
        userId,
        title: 'Azure Fundamentals',
        description: 'Complete AZ-900 certification',
        targetDate: '2024-10-31',
        status: 'active',
        progress: 30,
        metrics: {
          questionsTarget: 500,
          questionsCompleted: 150,
          accuracyTarget: 80,
          currentAccuracy: 75
        },
        createdAt: '2024-06-01T00:00:00Z',
        updatedAt: '2024-08-01T00:00:00Z'
      }
    ];

    // Apply filters
    let filteredGoals = mockGoals;
    if (status) {
      filteredGoals = mockGoals.filter(goal => goal.status === status);
    }

    // Apply pagination
    const paginatedGoals = filteredGoals.slice(offset, offset + limit);

    return this.listResponse(paginatedGoals, filteredGoals.length);
  }

  protected async handleGet(id: string, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Fetching goal', { goalId: id, userId });

    // Mock data lookup - in real implementation, query DynamoDB
    const mockGoal: StudyGoal | undefined = {
      goalId: id,
      userId,
      title: 'Pass AWS SAA-C03',
      description: 'Complete AWS Solutions Architect Associate certification',
      targetDate: '2024-12-31',
      status: 'active',
      progress: 75,
      metrics: {
        questionsTarget: 1000,
        questionsCompleted: 750,
        accuracyTarget: 85,
        currentAccuracy: 82
      },
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-08-01T00:00:00Z'
    };

    if (!mockGoal) {
      return this.notFoundResponse(id);
    }

    return this.itemResponse(mockGoal);
  }

  protected async handleCreate(data: StudyGoal | null, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Validate required data
    const validationError = this.validateCreateData(data);
    if (validationError) return validationError;

    // Validate required fields
    const requiredFields = ['title', 'targetDate'];
    const missingFields = this.validateRequiredFields(data, requiredFields);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        })
      };
    }

    this.logger.info('Creating goal', { userId, title: data!.title });

    // Create new goal - in real implementation, save to DynamoDB
    const newGoal: StudyGoal = {
      goalId: `goal-${Date.now()}`,
      userId,
      title: data!.title,
      description: data!.description || '',
      targetDate: data!.targetDate,
      status: 'active',
      progress: 0,
      metrics: {
        questionsTarget: data!.metrics?.questionsTarget || 100,
        questionsCompleted: 0,
        accuracyTarget: data!.metrics?.accuracyTarget || 80,
        currentAccuracy: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.createdResponse(newGoal);
  }

  protected async handleUpdate(id: string, data: Partial<StudyGoal> | null, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Validate required data
    const validationError = this.validateUpdateData(data);
    if (validationError) return validationError;

    this.logger.info('Updating goal', { goalId: id, userId, updates: Object.keys(data!) });

    // Check if goal exists and belongs to user - in real implementation, query DynamoDB
    const existingGoal = await this.mockGetGoal(id, userId);
    if (!existingGoal) {
      return this.notFoundResponse(id);
    }

    // Update goal - in real implementation, update in DynamoDB
    const updatedGoal: StudyGoal = {
      ...existingGoal,
      ...data,
      goalId: id, // Ensure ID doesn't change
      userId, // Ensure userId doesn't change
      updatedAt: new Date().toISOString()
    };

    return this.updatedResponse(updatedGoal);
  }

  protected async handleDelete(id: string, userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.info('Deleting goal', { goalId: id, userId });

    // Check if goal exists and belongs to user - in real implementation, query DynamoDB
    const existingGoal = await this.mockGetGoal(id, userId);
    if (!existingGoal) {
      return this.notFoundResponse(id);
    }

    // Delete goal - in real implementation, delete from DynamoDB
    this.logger.info('Goal deleted successfully', { goalId: id, userId });

    return this.deletedResponse();
  }

  // Helper method for mock data - replace with actual DynamoDB query
  private async mockGetGoal(id: string, userId: string): Promise<StudyGoal | null> {
    // This would be a DynamoDB query in real implementation
    return {
      goalId: id,
      userId,
      title: 'Pass AWS SAA-C03',
      description: 'Complete AWS Solutions Architect Associate certification',
      targetDate: '2024-12-31',
      status: 'active',
      progress: 75,
      metrics: {
        questionsTarget: 1000,
        questionsCompleted: 750,
        accuracyTarget: 85,
        currentAccuracy: 82
      },
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-08-01T00:00:00Z'
    };
  }
}

// Export the handler with authentication middleware and CRUD routing
const goalCrudHandler = new GoalCrudHandler();
export const handler = goalCrudHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => goalCrudHandler.handleCrudRequest(event, userId)
);