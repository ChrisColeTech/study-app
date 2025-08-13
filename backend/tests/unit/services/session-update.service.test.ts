// Unit tests for Session Update Service - Phase 17
// Tests the updateSession method functionality

import { SessionService } from '../../../src/services/session.service';
import { ISessionRepository } from '../../../src/repositories/session.repository';
import { IProviderService } from '../../../src/services/provider.service';
import { IExamService } from '../../../src/services/exam.service';
import { ITopicService } from '../../../src/services/topic.service';
import { IQuestionService } from '../../../src/services/question.service';
import { StudySession, SessionQuestion } from '../../../src/shared/types/domain.types';
import { UpdateSessionRequest } from '../../../src/shared/types/session.types';

// Mock repositories and services
const mockSessionRepository: jest.Mocked<ISessionRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
};

const mockProviderService: jest.Mocked<IProviderService> = {
  getProviders: jest.fn(),
  getProvider: jest.fn(),
  getProvidersByCategory: jest.fn(),
  getProvidersByStatus: jest.fn(),
  refreshCache: jest.fn(),
};

const mockExamService: jest.Mocked<IExamService> = {
  getExams: jest.fn(),
  getExam: jest.fn(),
  getExamsByProvider: jest.fn(),
};

const mockTopicService: jest.Mocked<ITopicService> = {
  getTopics: jest.fn(),
  getTopic: jest.fn(),
  getTopicsByExam: jest.fn(),
};

const mockQuestionService: jest.Mocked<IQuestionService> = {
  getQuestions: jest.fn(),
  getQuestion: jest.fn(),
  searchQuestions: jest.fn(),
};

describe('SessionService - Phase 17 Update Functionality', () => {
  let sessionService: SessionService;
  const mockTableName = 'test-sessions-table';
  const mockUserId = 'test-user-123';
  const mockSessionId = 'test-session-456';

  const mockSessionQuestion: SessionQuestion = {
    questionId: 'test-question-1',
    correctAnswer: ['0'],
    timeSpent: 0,
    skipped: false,
    markedForReview: false,
  };

  const mockSession: StudySession = {
    sessionId: mockSessionId,
    userId: mockUserId,
    examId: 'saa-c03',
    providerId: 'aws',
    startTime: '2024-01-01T10:00:00Z',
    status: 'active',
    questions: [mockSessionQuestion],
    currentQuestionIndex: 0,
    totalQuestions: 1,
    correctAnswers: 0,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  };

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

  describe('Session State Transitions', () => {
    test('should pause active session', async () => {
      // Mock repository calls
      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockSessionRepository.update.mockResolvedValue({
        ...mockSession,
        status: 'paused',
        updatedAt: '2024-01-01T10:05:00Z',
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'pause',
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.session.status).toBe('paused');
      expect(result.session.updatedAt).toBeDefined();
      expect(mockSessionRepository.findById).toHaveBeenCalledWith(mockSessionId);
      expect(mockSessionRepository.update).toHaveBeenCalled();
    });

    test('should resume paused session', async () => {
      const pausedSession = { ...mockSession, status: 'paused' as const };

      mockDynamoClient.onAnyCommand().resolves({
        Item: pausedSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'resume',
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.session.status).toBe('active');
    });

    test('should complete session and calculate score', async () => {
      const activeSession = { ...mockSession };

      mockDynamoClient.onAnyCommand().resolves({
        Item: activeSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'complete',
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.session.status).toBe('completed');
      expect(result.session.endTime).toBeDefined();
      expect(result.session.score).toBeDefined();
    });
  });

  describe('Question Navigation', () => {
    const multiQuestionSession = {
      ...mockSession,
      questions: [
        { ...mockSessionQuestion, questionId: 'q1' },
        { ...mockSessionQuestion, questionId: 'q2' },
        { ...mockSessionQuestion, questionId: 'q3' },
      ],
      totalQuestions: 3,
      currentQuestionIndex: 1,
    };

    test('should navigate to next question', async () => {
      mockDynamoClient.onAnyCommand().resolves({
        Item: multiQuestionSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'next',
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.session.currentQuestionIndex).toBe(2);
    });

    test('should navigate to previous question', async () => {
      mockDynamoClient.onAnyCommand().resolves({
        Item: multiQuestionSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'previous',
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.session.currentQuestionIndex).toBe(0);
    });

    test('should not navigate beyond boundaries', async () => {
      const firstQuestionSession = { ...multiQuestionSession, currentQuestionIndex: 0 };

      mockDynamoClient.onAnyCommand().resolves({
        Item: firstQuestionSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'previous',
      };

      await expect(
        sessionService.updateSession(mockSessionId, mockUserId, updateRequest)
      ).rejects.toThrow('Already at the first question');
    });
  });

  describe('Answer Submission', () => {
    test('should submit correct answer', async () => {
      // Mock question service to return question details
      const mockQuestionService = {
        getQuestion: jest.fn().mockResolvedValue({
          question: {
            questionId: 'test-question-1',
            questionText: 'Test question',
            options: ['Option A', 'Option B'],
            topicId: 'test-topic',
            difficulty: 'medium',
          },
        }),
      };
      mockServiceFactory.getQuestionService = jest.fn().mockReturnValue(mockQuestionService);

      // Create fresh session copy for this test
      const freshSession = {
        ...mockSession,
        questions: [{ ...mockSessionQuestion }],
      };

      mockDynamoClient.onAnyCommand().resolves({
        Item: freshSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'answer',
        questionId: 'test-question-1',
        userAnswer: ['0'], // Correct answer
        timeSpent: 45,
        skipped: false,
        markedForReview: false,
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      const updatedQuestion = result.session.questions[0];
      expect(updatedQuestion.userAnswer).toEqual(['0']);
      expect(updatedQuestion.isCorrect).toBe(true);
      expect(updatedQuestion.timeSpent).toBe(45);
      expect(result.session.correctAnswers).toBe(1);
    });

    test('should submit incorrect answer', async () => {
      const mockQuestionService = {
        getQuestion: jest.fn().mockResolvedValue({
          question: {
            questionId: 'test-question-1',
            questionText: 'Test question',
            options: ['Option A', 'Option B'],
            topicId: 'test-topic',
            difficulty: 'medium',
          },
        }),
      };
      mockServiceFactory.getQuestionService = jest.fn().mockReturnValue(mockQuestionService);

      // Create fresh session copy for this test
      const freshSession = {
        ...mockSession,
        questions: [{ ...mockSessionQuestion }],
      };

      mockDynamoClient.onAnyCommand().resolves({
        Item: freshSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'answer',
        questionId: 'test-question-1',
        userAnswer: ['1'], // Incorrect answer
        timeSpent: 60,
        skipped: false,
        markedForReview: true,
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      const updatedQuestion = result.session.questions[0];
      expect(updatedQuestion.userAnswer).toEqual(['1']);
      expect(updatedQuestion.isCorrect).toBe(false);
      expect(updatedQuestion.timeSpent).toBe(60);
      expect(updatedQuestion.markedForReview).toBe(true);
      expect(result.session.correctAnswers).toBe(0);
    });
  });

  describe('Mark for Review', () => {
    test('should mark question for review', async () => {
      const mockQuestionService = {
        getQuestion: jest.fn().mockResolvedValue({
          question: {
            questionId: 'test-question-1',
            questionText: 'Test question',
            options: ['Option A', 'Option B'],
            topicId: 'test-topic',
            difficulty: 'medium',
          },
        }),
      };
      mockServiceFactory.getQuestionService = jest.fn().mockReturnValue(mockQuestionService);

      mockDynamoClient.onAnyCommand().resolves({
        Item: mockSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'mark_for_review',
        questionId: 'test-question-1',
        markedForReview: true,
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.session.questions[0].markedForReview).toBe(true);
    });
  });

  describe('Validation Tests', () => {
    test('should reject updates to completed session', async () => {
      const completedSession = { ...mockSession, status: 'completed' as const };

      mockDynamoClient.onAnyCommand().resolves({
        Item: completedSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'pause',
      };

      await expect(
        sessionService.updateSession(mockSessionId, mockUserId, updateRequest)
      ).rejects.toThrow('Cannot modify completed session');
    });

    test("should reject access to other user's session", async () => {
      const otherUserSession = { ...mockSession, userId: 'other-user' };

      mockDynamoClient.onAnyCommand().resolves({
        Item: otherUserSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'pause',
      };

      await expect(
        sessionService.updateSession(mockSessionId, mockUserId, updateRequest)
      ).rejects.toThrow('Session not found or access denied');
    });

    test('should validate required fields for answer action', async () => {
      mockDynamoClient.onAnyCommand().resolves({
        Item: mockSession,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'answer',
        // Missing required fields
      };

      await expect(
        sessionService.updateSession(mockSessionId, mockUserId, updateRequest)
      ).rejects.toThrow('questionId, userAnswer, and timeSpent are required');
    });
  });

  describe('Progress Calculation', () => {
    test('should calculate progress correctly', async () => {
      const sessionWithAnswers = {
        ...mockSession,
        questions: [
          {
            ...mockSessionQuestion,
            questionId: 'q1',
            userAnswer: ['0'],
            isCorrect: true,
            timeSpent: 30,
          },
          {
            ...mockSessionQuestion,
            questionId: 'q2',
            userAnswer: ['1'],
            isCorrect: false,
            timeSpent: 45,
          },
          { ...mockSessionQuestion, questionId: 'q3', userAnswer: undefined, timeSpent: 0 }, // Unanswered
        ],
        totalQuestions: 3,
        correctAnswers: 1,
      };

      const mockQuestionService = {
        getQuestion: jest.fn().mockImplementation(({ questionId }: { questionId: string }) => ({
          question: {
            questionId,
            questionText: 'Test question',
            options: ['Option A', 'Option B'],
            topicId: 'test-topic',
            difficulty: 'medium',
          },
        })),
      };
      mockServiceFactory.getQuestionService = jest.fn().mockReturnValue(mockQuestionService);

      mockDynamoClient.onAnyCommand().resolves({
        Item: sessionWithAnswers,
      });

      const updateRequest: UpdateSessionRequest = {
        action: 'pause',
      };

      const result = await sessionService.updateSession(mockSessionId, mockUserId, updateRequest);

      expect(result.progress.totalQuestions).toBe(3);
      expect(result.progress.answeredQuestions).toBe(2);
      expect(result.progress.correctAnswers).toBe(1);
      expect(result.progress.accuracy).toBe(50); // 1 correct out of 2 answered
    });
  });
});
