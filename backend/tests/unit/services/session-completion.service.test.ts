// Unit tests for Session Completion Service
// Phase 21: Session Completion Feature

import { SessionService } from '../../../src/services/session.service';
import { SessionRepository } from '../../../src/repositories/session.repository';
import { ProviderService } from '../../../src/services/provider.service';
import { ExamService } from '../../../src/services/exam.service';
import { TopicService } from '../../../src/services/topic.service';
import { QuestionService } from '../../../src/services/question.service';
import { StudySession } from '../../../src/shared/types/domain.types';
import { CompleteSessionResponse } from '../../../src/shared/types/session.types';

// Mock dependencies
jest.mock('../../../src/repositories/session.repository');
jest.mock('../../../src/services/provider.service');
jest.mock('../../../src/services/exam.service');
jest.mock('../../../src/services/topic.service');
jest.mock('../../../src/services/question.service');

describe('SessionService - Session Completion', () => {
  let sessionService: SessionService;
  let mockSessionRepository: jest.Mocked<SessionRepository>;
  let mockProviderService: jest.Mocked<ProviderService>;
  let mockExamService: jest.Mocked<ExamService>;
  let mockTopicService: jest.Mocked<TopicService>;
  let mockQuestionService: jest.Mocked<QuestionService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mocked dependencies
    mockSessionRepository = new SessionRepository() as jest.Mocked<SessionRepository>;
    mockProviderService = new ProviderService() as jest.Mocked<ProviderService>;
    mockExamService = new ExamService() as jest.Mocked<ExamService>;
    mockTopicService = new TopicService() as jest.Mocked<TopicService>;
    mockQuestionService = new QuestionService() as jest.Mocked<QuestionService>;

    // Create service instance
    sessionService = new SessionService(
      mockSessionRepository,
      mockProviderService,
      mockExamService,
      mockTopicService,
      mockQuestionService
    );
  });

  const createMockSession = (overrides: Partial<StudySession> = {}): StudySession => ({
    sessionId: 'test-session-123',
    examId: 'saa-c03',
    providerId: 'aws',
    startTime: '2023-01-01T10:00:00Z',
    status: 'active',
    questions: [
      {
        questionId: 'q1',
        correctAnswer: ['option-0'],
        timeSpent: 45,
        skipped: false,
        markedForReview: false,
        userAnswer: ['option-0'],
        isCorrect: true,
        answeredAt: '2023-01-01T10:00:45Z',
      },
      {
        questionId: 'q2',
        correctAnswer: ['option-1'],
        timeSpent: 60,
        skipped: false,
        markedForReview: false,
        userAnswer: ['option-2'],
        isCorrect: false,
        answeredAt: '2023-01-01T10:01:45Z',
      },
    ],
    currentQuestionIndex: 1,
    totalQuestions: 2,
    correctAnswers: 1,
    createdAt: '2023-01-01T09:59:00Z',
    updatedAt: '2023-01-01T10:01:45Z',
    ...overrides,
  });

  const createMockQuestion = (questionId: string, overrides: any = {}) => ({
    questionId,
    providerId: 'aws',
    examId: 'saa-c03',
    topicId: 'topic-1',
    questionText: `Question ${questionId} text`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 0,
    explanation: `Explanation for ${questionId}`,
    difficulty: 'medium',
    tags: ['tag1'],
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    ...overrides,
  });

  describe('completeSession', () => {
    it('should complete a session successfully with all questions answered', async () => {
      // Arrange
      const mockSession = createMockSession();
      const mockQuestion1 = createMockQuestion('q1');
      const mockQuestion2 = createMockQuestion('q2');

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion
        .mockResolvedValueOnce({ question: mockQuestion1 })
        .mockResolvedValueOnce({ question: mockQuestion2 });
      mockTopicService.getTopic.mockResolvedValue({
        topic: { id: 'topic-1', name: 'Test Topic' },
      } as any);

      const completedSession = { ...mockSession, status: 'completed' as const };
      mockSessionRepository.update.mockResolvedValue(completedSession);

      // Act
      const result: CompleteSessionResponse =
        await sessionService.completeSession('test-session-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionSummary).toBeDefined();
      expect(result.sessionSummary.sessionId).toBe('test-session-123');
      expect(result.sessionSummary.totalQuestions).toBe(2);
      expect(result.sessionSummary.questionsCorrect).toBe(1);
      expect(result.sessionSummary.accuracy).toBe(50);
      expect(result.sessionSummary.passed).toBeDefined();

      expect(result.detailedResults).toBeDefined();
      expect(result.detailedResults.sessionId).toBe('test-session-123');
      expect(result.detailedResults.questionsBreakdown).toHaveLength(2);
      expect(result.detailedResults.performanceByDifficulty).toBeDefined();
      expect(result.detailedResults.performanceByTopic).toBeDefined();

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.overallRecommendation).toBeDefined();
      expect(result.recommendations.readinessForExam).toBeDefined();
      expect(result.recommendations.nextSessionRecommendation).toBeDefined();
      expect(result.recommendations.motivationalMessage).toBeDefined();

      // Verify session was updated to completed
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          status: 'completed',
          endTime: expect.any(String),
          score: expect.any(Number),
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw error when session not found', async () => {
      // Arrange
      mockSessionRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(sessionService.completeSession('non-existent-id')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should throw error when session is already completed', async () => {
      // Arrange
      const completedSession = createMockSession({ status: 'completed' });
      mockSessionRepository.findById.mockResolvedValue(completedSession);

      // Act & Assert
      await expect(sessionService.completeSession('test-session-123')).rejects.toThrow(
        'Session is already completed'
      );
    });

    it('should throw error when session is abandoned', async () => {
      // Arrange
      const abandonedSession = createMockSession({ status: 'abandoned' });
      mockSessionRepository.findById.mockResolvedValue(abandonedSession);

      // Act & Assert
      await expect(sessionService.completeSession('test-session-123')).rejects.toThrow(
        'Cannot complete abandoned session'
      );
    });

    it('should throw error when there are unanswered questions', async () => {
      // Arrange
      const sessionWithUnanswered = createMockSession({
        questions: [
          {
            questionId: 'q1',
            correctAnswer: ['option-0'],
            timeSpent: 45,
            skipped: false,
            markedForReview: false,
            userAnswer: ['option-0'],
            isCorrect: true,
            answeredAt: '2023-01-01T10:00:45Z',
          },
          {
            questionId: 'q2',
            correctAnswer: ['option-1'],
            timeSpent: 0,
            skipped: false,
            markedForReview: false,
            // No userAnswer - unanswered question
          },
        ],
      });
      mockSessionRepository.findById.mockResolvedValue(sessionWithUnanswered);

      // Act & Assert
      await expect(sessionService.completeSession('test-session-123')).rejects.toThrow(
        'Cannot complete session: 1 questions remain unanswered'
      );
    });

    it('should generate appropriate recommendations based on performance', async () => {
      // Arrange - High performance session
      const highPerformanceSession = createMockSession({
        questions: [
          {
            questionId: 'q1',
            correctAnswer: ['option-0'],
            timeSpent: 30,
            skipped: false,
            markedForReview: false,
            userAnswer: ['option-0'],
            isCorrect: true,
            answeredAt: '2023-01-01T10:00:30Z',
          },
          {
            questionId: 'q2',
            correctAnswer: ['option-1'],
            timeSpent: 35,
            skipped: false,
            markedForReview: false,
            userAnswer: ['option-1'],
            isCorrect: true,
            answeredAt: '2023-01-01T10:01:05Z',
          },
        ],
        correctAnswers: 2,
      });

      mockSessionRepository.findById.mockResolvedValue(highPerformanceSession);
      mockQuestionService.getQuestion.mockResolvedValue({ question: createMockQuestion('q1') });
      mockTopicService.getTopic.mockResolvedValue({
        topic: { id: 'topic-1', name: 'Test Topic' },
      } as any);
      mockSessionRepository.update.mockResolvedValue({
        ...highPerformanceSession,
        status: 'completed',
      } as any);

      // Act
      const result = await sessionService.completeSession('test-session-123');

      // Assert - Should recommend exam-level difficulty for high performers
      expect(result.recommendations.overallRecommendation).toBeOneOf(['excellent', 'good']);
      expect(result.recommendations.readinessForExam).toBe(true);
      expect(result.recommendations.nextSessionRecommendation.sessionType).toBe('exam');
      expect(result.recommendations.suggestedStudyTime).toBeLessThanOrEqual(30);
    });

    it('should handle question retrieval failures gracefully', async () => {
      // Arrange
      const mockSession = createMockSession();
      mockSessionRepository.findById.mockResolvedValue(mockSession);

      // Mock question service to fail for one question
      mockQuestionService.getQuestion
        .mockResolvedValueOnce({ question: createMockQuestion('q1') })
        .mockRejectedValueOnce(new Error('Question not found'));

      mockTopicService.getTopic.mockResolvedValue({
        topic: { id: 'topic-1', name: 'Test Topic' },
      } as any);
      mockSessionRepository.update.mockResolvedValue({
        ...mockSession,
        status: 'completed',
      } as any);

      // Act
      const result = await sessionService.completeSession('test-session-123');

      // Assert - Should complete successfully with placeholder for missing question
      expect(result.success).toBe(true);
      expect(result.detailedResults.questionsBreakdown).toHaveLength(2);
      expect(result.detailedResults.questionsBreakdown[1].questionText).toBe(
        'Question not available'
      );
      expect(result.detailedResults.questionsBreakdown[1].explanation).toBe(
        'No explanation available'
      );
    });

    it('should calculate performance metrics correctly', async () => {
      // Arrange
      const mockSession = createMockSession();
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockQuestionService.getQuestion.mockResolvedValue({
        question: createMockQuestion('q1', { difficulty: 'hard' }),
      });
      mockTopicService.getTopic.mockResolvedValue({
        topic: { id: 'topic-1', name: 'Test Topic' },
      } as any);
      mockSessionRepository.update.mockResolvedValue({
        ...mockSession,
        status: 'completed',
      } as any);

      // Act
      const result = await sessionService.completeSession('test-session-123');

      // Assert
      expect(result.detailedResults.accuracyPercentage).toBe(50); // 1 correct out of 2
      expect(result.detailedResults.totalTimeSpent).toBe(105); // 45 + 60 seconds
      expect(result.detailedResults.averageTimePerQuestion).toBe(52.5);
      expect(result.detailedResults.timeDistribution).toBeDefined();
      expect(result.detailedResults.performanceByDifficulty).toBeDefined();
    });
  });
});

// Helper matchers
expect.extend({
  toBeOneOf(received: any, validOptions: any[]) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(validOptions: any[]): R;
    }
  }
}
