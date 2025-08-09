import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';

/**
 * Question Handler - Study question management
 */
class QuestionHandler extends BaseHandler {
  constructor() {
    super('QuestionHandler');
  }

  public async getQuestions(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    // Mock question data
    const questions = [
      {
        questionId: 'q1',
        text: 'Which AWS service provides object storage?',
        options: ['EC2', 'S3', 'RDS', 'Lambda'],
        correctAnswer: 1,
        provider: 'aws',
        exam: 'saa-c03'
      }
    ];

    return this.success({ questions, totalCount: questions.length });
  }
}

const questionHandler = new QuestionHandler();
export const handler = questionHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => questionHandler.getQuestions(event, userId)
);