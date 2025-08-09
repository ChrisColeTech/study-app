import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';

/**
 * Session Handler - Study session management
 */
class SessionHandler extends BaseHandler {
  constructor() {
    super('SessionHandler');
  }

  public async handleRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod } = event;
    
    switch (httpMethod) {
      case 'GET':
        return this.getSessions(event, userId);
      case 'POST':
        return this.createSession(event, userId);
      default:
        return this.methodNotAllowed('Method not supported');
    }
  }

  private async getSessions(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const mockSessions = [
      {
        sessionId: 's1',
        userId,
        provider: 'aws',
        exam: 'saa-c03',
        status: 'completed'
      }
    ];

    return this.success({ sessions: mockSessions });
  }

  private async createSession(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const body = this.parseJsonBody(event);
    
    const newSession = {
      sessionId: `s-${Date.now()}`,
      userId,
      provider: (body as any)?.provider || 'aws',
      exam: (body as any)?.exam || 'saa-c03',
      status: 'active' as const,
      createdAt: new Date().toISOString()
    };

    return this.created(newSession, 'Session created successfully');
  }

  private methodNotAllowed(message: string): APIGatewayProxyResult {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message })
    };
  }
}

const sessionHandler = new SessionHandler();
export const handler = sessionHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => sessionHandler.handleRequest(event, userId)
);