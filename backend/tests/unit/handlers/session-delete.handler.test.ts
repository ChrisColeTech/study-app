// Phase 19: Session Deletion Handler Tests
// Tests the DELETE endpoint functionality in SessionHandler

import { SessionHandler } from '../../../src/handlers/session';
import { HandlerContext } from '../../../src/shared/types/api.types';
import { SessionService } from '../../../src/services/session.service';
import { ServiceFactory } from '../../../src/shared/service-factory';

// Mock ServiceFactory
jest.mock('../../../src/shared/service-factory');

// Mock SessionService
const mockSessionService: jest.Mocked<SessionService> = {
  createSession: jest.fn(),
  getSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn()
} as any;

describe('SessionHandler - Phase 19 Delete Endpoint', () => {
  let sessionHandler: SessionHandler;
  let mockServiceFactory: jest.Mocked<ServiceFactory>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup ServiceFactory mock
    mockServiceFactory = {
      getInstance: jest.fn().mockReturnThis(),
      getSessionService: jest.fn().mockReturnValue(mockSessionService)
    } as any;
    (ServiceFactory.getInstance as jest.Mock).mockReturnValue(mockServiceFactory);

    sessionHandler = new SessionHandler();
  });

  const createMockContext = (sessionId?: string): HandlerContext => ({
    requestId: 'test-request-123',
    event: {
      httpMethod: 'DELETE',
      path: `/v1/sessions/${sessionId || '550e8400-e29b-41d4-a716-446655440000'}`,
      pathParameters: { id: sessionId || '550e8400-e29b-41d4-a716-446655440000' },
      queryStringParameters: null,
      headers: { 'Content-Type': 'application/json' },
      body: null,
      requestContext: { requestId: 'test-request-123' } as any,
      isBase64Encoded: false
    }
  });

  describe('DELETE /v1/sessions/{id}', () => {
    test('should successfully delete a session', async () => {
      // Arrange
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext(sessionId);
      
      mockSessionService.deleteSession.mockResolvedValue({
        success: true,
        message: 'Session deleted successfully'
      });

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        message: 'Session deleted successfully',
        data: {
          success: true,
          message: 'Session deleted successfully'
        },
        timestamp: expect.any(String)
      });
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    test('should return 404 when session not found', async () => {
      // Arrange
      const sessionId = '550e8400-e29b-41d4-a716-446655440999';
      const context = createMockContext(sessionId);
      
      mockSessionService.deleteSession.mockRejectedValue(
        new Error('Session not found: ' + sessionId)
      );

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('NOT_FOUND');
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    test('should return 409 when trying to delete completed session', async () => {
      // Arrange
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext(sessionId);
      
      mockSessionService.deleteSession.mockRejectedValue(
        new Error('Cannot delete completed sessions - they are archived for analytics')
      );

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('CONFLICT');
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    test('should return 400 for invalid session ID format', async () => {
      // Arrange
      const invalidSessionId = 'invalid-id';
      const context = createMockContext(invalidSessionId);

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('VALIDATION_ERROR');
      expect(responseBody.error.message).toBe('Invalid session ID format');
      expect(mockSessionService.deleteSession).not.toHaveBeenCalled();
    });

    test('should return 400 when session ID is missing', async () => {
      // Arrange
      const context: HandlerContext = {
        requestId: 'test-request-123',
        event: {
          httpMethod: 'DELETE',
          path: '/v1/sessions/',
          pathParameters: null,
          queryStringParameters: null,
          headers: { 'Content-Type': 'application/json' },
          body: null,
          requestContext: { requestId: 'test-request-123' } as any,
          isBase64Encoded: false
        }
      };

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('VALIDATION_ERROR');
      expect(responseBody.error.message).toBe('Session ID is required');
      expect(mockSessionService.deleteSession).not.toHaveBeenCalled();
    });

    test('should return 500 for unexpected errors', async () => {
      // Arrange
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext(sessionId);
      
      mockSessionService.deleteSession.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('INTERNAL_ERROR');
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('Session ID Validation', () => {
    test('should accept valid UUID format', async () => {
      // Arrange
      const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
      const context = createMockContext(validSessionId);
      
      mockSessionService.deleteSession.mockResolvedValue({
        success: true,
        message: 'Session deleted successfully'
      });

      // Act
      const response = await sessionHandler.handle(context.event, {} as any);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(validSessionId);
    });

    test('should reject non-UUID format', async () => {
      const invalidFormats = [
        '123',
        'abc-def-ghi',
        '550e8400-e29b-41d4-a716-446655440000-extra',
        'not-a-uuid-at-all'
      ];

      for (const invalidId of invalidFormats) {
        // Arrange
        const context = createMockContext(invalidId);

        // Act
        const response = await sessionHandler.handle(context.event, {} as any);

        // Assert
        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.code).toBe('VALIDATION_ERROR');
        expect(responseBody.error.message).toBe('Invalid session ID format');
      }

      expect(mockSessionService.deleteSession).not.toHaveBeenCalled();
    });
  });
});