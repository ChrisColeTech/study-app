import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';

/**
 * Goal Handler - Study goal management
 */
class GoalHandler extends BaseHandler {
  constructor() {
    super('GoalHandler');
  }

  public async getGoals(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const mockGoals = [
      {
        goalId: 'g1',
        userId,
        title: 'Pass AWS SAA-C03',
        status: 'active',
        progress: 65
      }
    ];

    return this.success({ goals: mockGoals });
  }
}

const goalHandler = new GoalHandler();
export const handler = goalHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => goalHandler.getGoals(event, userId)
);