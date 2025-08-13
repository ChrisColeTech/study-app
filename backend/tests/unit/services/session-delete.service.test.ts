// Phase 19: Session Deletion Feature Tests
// Tests the deleteSession functionality in SessionService

import { SessionService, ISessionService } from '../../../src/services/session.service';
import { ISessionRepository } from '../../../src/repositories/session.repository';
import { IProviderService } from '../../../src/services/provider.service';
import { IExamService } from '../../../src/services/exam.service';
import { ITopicService } from '../../../src/services/topic.service';
import { IQuestionService } from '../../../src/services/question.service';
import { StudySession } from '../../../src/shared/types/domain.types';

// Mock implementations
const mockSessionRepository: jest.Mocked<ISessionRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
};

const mockProviderService: jest.Mocked<IProviderService> = {
  getProvider: jest.fn(),
  getProviders: jest.fn(),
  searchProviders: jest.fn(),
  refreshCache: jest.fn(),
};

const mockExamService: jest.Mocked<IExamService> = {
  getExam: jest.fn(),
  getExams: jest.fn(),
};

const mockTopicService: jest.Mocked<ITopicService> = {
  getTopic: jest.fn(),
  getTopics: jest.fn(),
};

const mockQuestionService: jest.Mocked<IQuestionService> = {
  getQuestion: jest.fn(),
  getQuestions: jest.fn(),
  searchQuestions: jest.fn(),
};

describe('SessionService - Phase 19 Delete Functionality', () => {
  let sessionService: ISessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService = new SessionService(
      mockSessionRepository,
      mockProviderService,
      mockExamService,
      mockTopicService,
      mockQuestionService
    );
  });

  const mockActiveSession: StudySession = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    examId: 'saa-c03',
    providerId: 'aws',
    startTime: '2024-01-15T10:00:00Z',
    status: 'active',
    questions: [
      {
        questionId: 'q1',
        correctAnswer: ['A'],
        timeSpent: 30,
        skipped: false,
        markedForReview: false,
      },
    ],
    currentQuestionIndex: 0,
    totalQuestions: 1,
    correctAnswers: 0,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  };

  describe('Session Deletion', () => {
    test('should successfully delete an active session', async () => {
      // Arrange
      mockSessionRepository.findById.mockResolvedValue(mockActiveSession);
      mockSessionRepository.update.mockResolvedValue({
        ...mockActiveSession,
        status: 'abandoned',
        updatedAt: '2024-01-15T10:30:00Z',
      });

      // Act
      const result = await sessionService.deleteSession(mockActiveSession.sessionId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Session deleted successfully',
      });
      expect(mockSessionRepository.findById).toHaveBeenCalledWith(mockActiveSession.sessionId);
      expect(mockSessionRepository.update).toHaveBeenCalledWith(mockActiveSession.sessionId, {
        status: 'abandoned',
        updatedAt: expect.any(String),
      });
    });

    test('should successfully delete a paused session', async () => {
      // Arrange
      const pausedSession = { ...mockActiveSession, status: 'paused' as const };
      mockSessionRepository.findById.mockResolvedValue(pausedSession);
      mockSessionRepository.update.mockResolvedValue({
        ...pausedSession,
        status: 'abandoned',
        updatedAt: '2024-01-15T10:30:00Z',
      });

      // Act
      const result = await sessionService.deleteSession(pausedSession.sessionId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Session deleted successfully',
      });
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        pausedSession.sessionId,
        expect.objectContaining({ status: 'abandoned' })
      );
    });

    test('should throw error when session not found', async () => {
      // Arrange
      const nonExistentSessionId = '550e8400-e29b-41d4-a716-446655440999';
      mockSessionRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(sessionService.deleteSession(nonExistentSessionId)).rejects.toThrow(
        `Session not found: ${nonExistentSessionId}`
      );

      expect(mockSessionRepository.findById).toHaveBeenCalledWith(nonExistentSessionId);
      expect(mockSessionRepository.update).not.toHaveBeenCalled();
    });

    test('should throw error when trying to delete completed session', async () => {
      // Arrange
      const completedSession = {
        ...mockActiveSession,
        status: 'completed' as const,
        endTime: '2024-01-15T11:00:00Z',
        score: 85,
      };
      mockSessionRepository.findById.mockResolvedValue(completedSession);

      // Act & Assert
      await expect(sessionService.deleteSession(completedSession.sessionId)).rejects.toThrow(
        'Cannot delete completed sessions - they are archived for analytics'
      );

      expect(mockSessionRepository.findById).toHaveBeenCalledWith(completedSession.sessionId);
      expect(mockSessionRepository.update).not.toHaveBeenCalled();
    });

    test('should handle repository update errors', async () => {
      // Arrange
      mockSessionRepository.findById.mockResolvedValue(mockActiveSession);
      mockSessionRepository.update.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(sessionService.deleteSession(mockActiveSession.sessionId)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockSessionRepository.findById).toHaveBeenCalledWith(mockActiveSession.sessionId);
      expect(mockSessionRepository.update).toHaveBeenCalled();
    });

    test('should handle repository findById errors', async () => {
      // Arrange
      mockSessionRepository.findById.mockRejectedValue(new Error('Database timeout'));

      // Act & Assert
      await expect(sessionService.deleteSession(mockActiveSession.sessionId)).rejects.toThrow(
        'Database timeout'
      );

      expect(mockSessionRepository.findById).toHaveBeenCalledWith(mockActiveSession.sessionId);
      expect(mockSessionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Session Status Logic', () => {
    test('should mark session as abandoned instead of hard delete', async () => {
      // Arrange
      mockSessionRepository.findById.mockResolvedValue(mockActiveSession);
      mockSessionRepository.update.mockResolvedValue({
        ...mockActiveSession,
        status: 'abandoned',
        updatedAt: '2024-01-15T10:30:00Z',
      });

      // Act
      await sessionService.deleteSession(mockActiveSession.sessionId);

      // Assert - Verify it's a soft delete (status change) not hard delete
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        mockActiveSession.sessionId,
        expect.objectContaining({
          status: 'abandoned',
          updatedAt: expect.any(String),
        })
      );
      expect(mockSessionRepository.delete).not.toHaveBeenCalled(); // Should not use hard delete
    });

    test('should update timestamp when marking as abandoned', async () => {
      // Arrange
      const beforeDelete = new Date().toISOString();
      mockSessionRepository.findById.mockResolvedValue(mockActiveSession);
      mockSessionRepository.update.mockResolvedValue({
        ...mockActiveSession,
        status: 'abandoned',
        updatedAt: '2024-01-15T10:30:00Z',
      });

      // Act
      await sessionService.deleteSession(mockActiveSession.sessionId);

      // Assert
      const updateCall = mockSessionRepository.update.mock.calls[0];
      expect(updateCall[1]).toHaveProperty('updatedAt');
      expect(typeof updateCall[1].updatedAt).toBe('string');
      // Timestamp should be recent (within last few seconds)
      const updatedAt = new Date(updateCall[1].updatedAt);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(new Date(beforeDelete).getTime());
    });
  });
});
